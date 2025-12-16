import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// Mock modules
vi.mock("@/lib/llm/generateEmailSpec", () => ({
  generateEmailSpec: vi.fn(),
}));

vi.mock("@/lib/llm/errors", () => ({
  LLMError: class LLMError extends Error {
    constructor(public code: string, message: string, public cause?: unknown) {
      super(message);
      this.name = "LLMError";
    }
  },
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    constructor() {}
    chat = {
      completions: {
        create: vi.fn(),
      },
    };
  },
}));

import { generateEmailSpec } from "@/lib/llm/generateEmailSpec";
import { LLMError } from "@/lib/llm/errors";

describe("POST /api/email/spec", () => {
  const validBrandContext = {
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
  };

  const validIntent = {
    type: "sale",
    tone: "premium",
  };

  const validPlan = {
    campaignType: "sale",
    goal: "Drive sales",
    sections: [{ type: "header" }, { type: "hero" }, { type: "footer" }],
  };

  const validSpec = {
    meta: {
      subject: "Test Subject",
      preheader: "Test preheader text",
    },
    theme: {
      containerWidth: 600,
      backgroundColor: "#FFFFFF",
      surfaceColor: "#F5F5F5",
      textColor: "#111111",
      mutedTextColor: "#666666",
      primaryColor: "#111111",
      font: { heading: "Arial", body: "Arial" },
      button: { radius: 8, style: "solid", paddingY: 12, paddingX: 24 },
    },
    sections: [
      {
        id: "header-1",
        type: "header",
        blocks: [{ type: "logo", src: "https://test.com/logo.png" }],
      },
      {
        id: "hero-1",
        type: "hero",
        blocks: [
          { type: "heading", text: "Welcome", level: 1 },
          { type: "button", text: "Shop Now", href: "https://test.com" },
        ],
      },
      {
        id: "footer-1",
        type: "footer",
        blocks: [{ type: "smallPrint", text: "{{unsubscribe}}" }],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("should return 200 with valid request", async () => {
    vi.mocked(generateEmailSpec).mockResolvedValue({
      spec: validSpec as any,
      warnings: [],
    });

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spec).toBeDefined();
    expect(data.spec.meta.subject).toBe("Test Subject");
  });

  it("should return 200 with warnings array", async () => {
    const warnings = [
      {
        code: "THEME_COLOR_DRIFT",
        severity: "warning" as const,
        message: "Color drift detected",
        path: "theme.primaryColor",
      },
    ];

    vi.mocked(generateEmailSpec).mockResolvedValue({
      spec: validSpec as any,
      warnings,
    });

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spec).toBeDefined();
    expect(data.warnings).toBeDefined();
    expect(data.warnings).toHaveLength(1);
    expect(data.warnings[0].code).toBe("THEME_COLOR_DRIFT");
  });

  it("should return 400 for missing brandContext", async () => {
    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        intent: validIntent,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_REQUEST");
  });

  it("should return 400 for missing intent", async () => {
    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_REQUEST");
  });

  it("should return 400 for missing plan", async () => {
    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_REQUEST");
  });

  it("should return 400 for invalid brandContext schema", async () => {
    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: { invalid: "data" },
        intent: validIntent,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_REQUEST");
  });

  it("should return 400 for invalid intent schema", async () => {
    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: { type: "invalid-type" },
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_REQUEST");
  });

  it("should return 400 for invalid plan schema", async () => {
    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: { campaignType: "sale", goal: "test" }, // Missing sections
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_REQUEST");
  });

  it("should return 500 for LLM_CONFIG_MISSING error", async () => {
    delete process.env.OPENAI_API_KEY;

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("LLM_CONFIG_MISSING");
  });

  it("should return 502 for LLM_OUTPUT_INVALID error", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(
      new LLMError("LLM_OUTPUT_INVALID", "Invalid output")
    );

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("LLM_OUTPUT_INVALID");
  });

  it("should return 500 for LLM_FAILED error", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(
      new LLMError("LLM_FAILED", "LLM request failed")
    );

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("LLM_FAILED");
  });

  it("should return 504 for LLM_TIMEOUT error", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(
      new LLMError("LLM_TIMEOUT", "Request timed out")
    );

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.error.code).toBe("LLM_TIMEOUT");
  });

  it("should return 500 for unexpected errors", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(new Error("Unexpected error"));

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("INTERNAL_ERROR");
  });

  it("should not leak stack traces in error responses", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(
      new Error("[This is a stack trace that should not be leaked]")
    );

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("INTERNAL_ERROR");
    expect(data.error.message).toBe("An unexpected error occurred");
    expect(JSON.stringify(data)).not.toContain("stack trace");
  });

  it("should handle spec with empty catalog", async () => {
    const specWithEmptyCatalog = {
      ...validSpec,
      catalog: { items: [] },
    };

    vi.mocked(generateEmailSpec).mockResolvedValue({
      spec: specWithEmptyCatalog as any,
      warnings: [],
    });

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: validPlan,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spec).toBeDefined();
  });

  it("should pass all fields from request to generateEmailSpec", async () => {
    vi.mocked(generateEmailSpec).mockResolvedValue({
      spec: validSpec as any,
      warnings: [],
    });

    const request = new NextRequest("http://localhost:3000/api/email/spec", {
      method: "POST",
      body: JSON.stringify({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: validPlan,
      }),
    });

    await POST(request);

    expect(generateEmailSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        brandContext: validBrandContext,
        intent: validIntent,
        plan: validPlan,
        llmClient: expect.anything(),
      })
    );
  });
});
