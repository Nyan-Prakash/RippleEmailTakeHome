import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";
import type { EmailSpec } from "../../../../../lib/schemas/emailSpec";

// Mock the generateEmailSpec function
vi.mock("../../../../../lib/llm/generateEmailSpec", () => ({
  generateEmailSpec: vi.fn(),
}));

vi.mock("../../../../../lib/llm/errors", () => ({
  LLMError: class LLMError extends Error {
    constructor(
      public code: string,
      message: string
    ) {
      super(message);
      this.name = "LLMError";
    }
  },
}));

import { generateEmailSpec } from "../../../../../lib/llm/generateEmailSpec";
import { LLMError } from "../../../../../lib/llm/errors";

describe("POST /api/email/spec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validRequestBody = {
    brandContext: {
      brand: {
        name: "Test Brand",
        website: "https://test.com",
        logoUrl: "https://test.com/logo.png",
        colors: {
          primary: "#111111",
          background: "#FFFFFF",
          text: "#111111",
        },
        fonts: {
          heading: "Arial",
          body: "Arial",
        },
        voiceHints: [],
        snippets: {},
      },
      catalog: [],
      trust: {},
    },
    intent: {
      type: "sale",
      tone: "premium",
    },
    plan: {
      campaignType: "sale",
      goal: "Drive sales",
      sections: [{ type: "header" }, { type: "hero" }, { type: "footer" }],
    },
  };

  const mockEmailSpec = {
    meta: {
      subject: "Test Subject",
      preheader: "Test preheader",
    },
    theme: {
      containerWidth: 600,
      backgroundColor: "#FFFFFF",
      surfaceColor: "#F5F5F5",
      textColor: "#111111",
      mutedTextColor: "#666666",
      primaryColor: "#111111",
      font: { heading: "Arial", body: "Arial" },
      button: { radius: 8, style: "solid" },
    },
    sections: [
      {
        id: "header-1",
        type: "header",
        blocks: [],
      },
      {
        id: "hero-1",
        type: "hero",
        blocks: [{ type: "button", text: "Shop", href: "https://test.com" }],
      },
      {
        id: "footer-1",
        type: "footer",
        blocks: [
          { type: "smallPrint", text: "{{unsubscribe}}", align: "center" },
        ],
      },
    ],
  };

  it("should return 200 with spec on success", async () => {
    vi.mocked(generateEmailSpec).mockResolvedValue({
      spec: mockEmailSpec as unknown as EmailSpec,
      warnings: [],
    });

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify(validRequestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spec).toBeDefined();
    expect(data.spec.meta.subject).toBe("Test Subject");
  });

  it("should return spec with warnings when warnings exist", async () => {
    const warnings = [
      {
        code: "THEME_COLOR_DRIFT",
        severity: "warning" as const,
        message: "Theme color differs from brand color",
        path: "theme.primaryColor",
      },
    ];

    vi.mocked(generateEmailSpec).mockResolvedValue({
      spec: mockEmailSpec as unknown as EmailSpec,
      warnings,
    });

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify(validRequestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spec).toBeDefined();
    expect(data.warnings).toBeDefined();
    expect(data.warnings).toHaveLength(1);
    expect(data.warnings[0].code).toBe("THEME_COLOR_DRIFT");
  });

  it("should return 400 for invalid request body", async () => {
    const invalidBody = {
      brandContext: {}, // Missing required fields
      intent: {},
      plan: {},
    };

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify(invalidBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_REQUEST");
  });

  it("should return 504 on timeout", async () => {
    vi.mocked(generateEmailSpec).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                spec: mockEmailSpec as unknown as EmailSpec,
                warnings: [],
              }),
            20000
          );
        })
    );

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify(validRequestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.error.code).toBe("LLM_TIMEOUT");
  });

  it("should return 502 on LLM_OUTPUT_INVALID error", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(
      new (LLMError as unknown as EmailSpec)(
        "LLM_OUTPUT_INVALID",
        "Invalid output"
      )
    );

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify(validRequestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("LLM_OUTPUT_INVALID");
  });

  it("should return 500 for generic errors", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(
      new Error("Something went wrong")
    );

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify(validRequestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("INTERNAL_ERROR");
  });

  it("should not include warnings field when warnings array is empty", async () => {
    vi.mocked(generateEmailSpec).mockResolvedValue({
      spec: mockEmailSpec as unknown as EmailSpec,
      warnings: [],
    });

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify(validRequestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spec).toBeDefined();
    expect(data.warnings).toBeUndefined();
  });
});
