import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";
import type { BrandContext } from "../../../../../lib/types";

// Mock the parseCampaignIntent module
vi.mock("../../../../../lib/llm/parseCampaignIntent", () => ({
  parseCampaignIntent: vi.fn(),
}));

// Mock the LLMError class
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

import { parseCampaignIntent } from "../../../../../lib/llm/parseCampaignIntent";
import { LLMError } from "../../../../../lib/llm/errors";

const mockBrandContext: BrandContext = {
  brand: {
    name: "Test Brand",
    website: "https://test.com",
    logoUrl: "https://test.com/logo.png",
    colors: {
      primary: "#000000",
      background: "#FFFFFF",
      text: "#333333",
    },
    fonts: {
      heading: "Arial",
      body: "Helvetica",
    },
    voiceHints: ["friendly"],
    snippets: {},
  },
  catalog: [],
  trust: {},
};

const mockCampaignIntent = {
  type: "sale" as const,
  goal: "Drive sales",
  urgency: "high" as const,
  tone: "urgent" as const,
  cta: {
    primary: "Shop Now",
  },
  keywords: ["sale", "discount"],
  confidence: 0.9,
  rationale: "Clear sale campaign",
};

function createMockRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/campaign/intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/campaign/intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with valid request", async () => {
    vi.mocked(parseCampaignIntent).mockResolvedValue(mockCampaignIntent);

    const request = createMockRequest({
      brandContext: mockBrandContext,
      prompt: "create a sale email",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.intent).toEqual(mockCampaignIntent);
    expect(parseCampaignIntent).toHaveBeenCalledWith({
      brandContext: mockBrandContext,
      prompt: "create a sale email",
    });
  });

  it("should return 400 for missing brandContext", async () => {
    const request = createMockRequest({
      prompt: "create a sale email",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PROMPT");
    expect(parseCampaignIntent).not.toHaveBeenCalled();
  });

  it("should return 400 for missing prompt", async () => {
    const request = createMockRequest({
      brandContext: mockBrandContext,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PROMPT");
    expect(parseCampaignIntent).not.toHaveBeenCalled();
  });

  it("should return 400 for empty prompt", async () => {
    const request = createMockRequest({
      brandContext: mockBrandContext,
      prompt: "",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PROMPT");
  });

  it("should return 400 for INVALID_PROMPT error", async () => {
    vi.mocked(parseCampaignIntent).mockRejectedValue(
      new LLMError("INVALID_PROMPT", "The prompt is empty or invalid")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      prompt: "test",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PROMPT");
    expect(data.error.message).toBe("The prompt is empty or invalid");
  });

  it("should return 500 for LLM_CONFIG_MISSING error", async () => {
    vi.mocked(parseCampaignIntent).mockRejectedValue(
      new LLMError("LLM_CONFIG_MISSING", "LLM API configuration is missing")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      prompt: "test",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("LLM_CONFIG_MISSING");
  });

  it("should return 502 for LLM_FAILED error", async () => {
    vi.mocked(parseCampaignIntent).mockRejectedValue(
      new LLMError("LLM_FAILED", "Failed to generate campaign intent")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      prompt: "test",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("LLM_FAILED");
  });

  it("should return 504 for LLM_TIMEOUT error", async () => {
    vi.mocked(parseCampaignIntent).mockRejectedValue(
      new LLMError("LLM_TIMEOUT", "LLM request timed out")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      prompt: "test",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.error.code).toBe("LLM_TIMEOUT");
  });

  it("should return 502 for LLM_OUTPUT_INVALID error", async () => {
    vi.mocked(parseCampaignIntent).mockRejectedValue(
      new LLMError("LLM_OUTPUT_INVALID", "LLM output could not be validated")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      prompt: "test",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("LLM_OUTPUT_INVALID");
  });

  it("should return 500 for unexpected errors", async () => {
    vi.mocked(parseCampaignIntent).mockRejectedValue(
      new Error("Unexpected error")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      prompt: "test",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("INTERNAL");
    expect(data.error.message).toBe("An unexpected error occurred");
  });

  it("should return 400 for invalid brandContext schema", async () => {
    const invalidBrandContext = {
      brand: {
        name: "Test",
        // Missing required fields
      },
    };

    const request = createMockRequest({
      brandContext: invalidBrandContext,
      prompt: "test",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PROMPT");
  });

  it("should handle complex valid brand context", async () => {
    vi.mocked(parseCampaignIntent).mockResolvedValue(mockCampaignIntent);

    const complexBrandContext: BrandContext = {
      brand: {
        name: "Complex Brand",
        website: "https://complex.com",
        logoUrl: "https://complex.com/logo.png",
        colors: {
          primary: "#FF0000",
          background: "#FFFFFF",
          text: "#000000",
        },
        fonts: {
          heading: "Montserrat",
          body: "Open Sans",
        },
        voiceHints: ["bold", "innovative", "trustworthy"],
        snippets: {
          tagline: "Innovation at its finest",
        },
      },
      catalog: [
        {
          id: "prod1",
          title: "Product 1",
          price: "$99.99",
          image: "https://complex.com/product1.jpg",
          url: "https://complex.com/product1",
        },
      ],
      trust: {
        shippingPolicy: "Free shipping on orders over $50",
        returnPolicy: "30-day money-back guarantee",
      },
    };

    const request = createMockRequest({
      brandContext: complexBrandContext,
      prompt: "launch campaign for new product",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.intent).toEqual(mockCampaignIntent);
  });

  it("should not leak stack traces in error responses", async () => {
    const errorWithStack = new Error("Internal error");
    errorWithStack.stack = "This is a stack trace that should not be leaked";

    vi.mocked(parseCampaignIntent).mockRejectedValue(errorWithStack);

    const request = createMockRequest({
      brandContext: mockBrandContext,
      prompt: "test",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(data)).not.toContain("stack");
    expect(JSON.stringify(data)).not.toContain("This is a stack trace");
  });
});
