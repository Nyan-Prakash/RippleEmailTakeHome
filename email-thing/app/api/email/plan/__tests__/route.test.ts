import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";
import type { BrandContext } from "../../../../../lib/schemas/brand";
import type { CampaignIntent } from "../../../../../lib/llm/schemas/campaignIntent";

// Mock the planEmail module
vi.mock("../../../../../lib/llm/planEmail", () => ({
  planEmail: vi.fn(),
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

import { planEmail } from "../../../../../lib/llm/planEmail";
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

const mockIntent: CampaignIntent = {
  type: "sale",
  goal: "Drive sales",
  urgency: "high",
  tone: "urgent",
  cta: {
    primary: "Shop Now",
  },
  keywords: ["sale", "discount"],
  confidence: 0.9,
  rationale: "Clear sale campaign",
};

const mockEmailPlan = {
  subject: {
    primary: "50% Off Everything",
    alternatives: ["Save Big Today"],
  },
  preheader: "Limited time offer",
  layout: {
    template: "hero" as const,
    density: "medium" as const,
  },
  sections: [
    {
      id: "header",
      type: "header" as const,
      purpose: "Brand identity",
    },
    {
      id: "hero",
      type: "hero" as const,
      purpose: "Main offer",
      headline: "50% Off",
    },
    {
      id: "footer",
      type: "footer" as const,
      purpose: "Legal",
    },
  ],
  selectedProducts: [],
  personalization: {
    level: "light" as const,
    ideas: ["Use first name"],
  },
  compliance: {
    includeUnsubscribe: true as const,
    includePhysicalAddressHint: true as const,
  },
  confidence: 0.92,
  rationale: "Strong sale campaign",
};

function createMockRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/email/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/email/plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with valid request", async () => {
    vi.mocked(planEmail).mockResolvedValue(mockEmailPlan);

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.plan).toEqual(mockEmailPlan);
    expect(planEmail).toHaveBeenCalledWith({
      brandContext: mockBrandContext,
      intent: mockIntent,
    });
  });

  it("should return 400 for missing brandContext", async () => {
    const request = createMockRequest({
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
    expect(planEmail).not.toHaveBeenCalled();
  });

  it("should return 400 for missing intent", async () => {
    const request = createMockRequest({
      brandContext: mockBrandContext,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
    expect(planEmail).not.toHaveBeenCalled();
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
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("should return 400 for invalid intent schema", async () => {
    const invalidIntent = {
      type: "sale",
      // Missing required fields
    };

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: invalidIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("should return 500 for LLM_CONFIG_MISSING error", async () => {
    vi.mocked(planEmail).mockRejectedValue(
      new LLMError("LLM_CONFIG_MISSING", "LLM API configuration is missing")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("LLM_CONFIG_MISSING");
  });

  it("should return 502 for LLM_FAILED error", async () => {
    vi.mocked(planEmail).mockRejectedValue(
      new LLMError("LLM_FAILED", "Failed to generate response from LLM")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("LLM_FAILED");
  });

  it("should return 504 for LLM_TIMEOUT error", async () => {
    vi.mocked(planEmail).mockRejectedValue(
      new LLMError("LLM_TIMEOUT", "LLM request timed out")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.error.code).toBe("LLM_TIMEOUT");
  });

  it("should return 502 for LLM_OUTPUT_INVALID error", async () => {
    vi.mocked(planEmail).mockRejectedValue(
      new LLMError("LLM_OUTPUT_INVALID", "LLM output could not be validated")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("LLM_OUTPUT_INVALID");
  });

  it("should return 500 for unexpected errors", async () => {
    vi.mocked(planEmail).mockRejectedValue(new Error("Unexpected error"));

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("INTERNAL");
    expect(data.error.message).toBe("An unexpected error occurred");
  });

  it("should handle email plan with products", async () => {
    const planWithProducts = {
      ...mockEmailPlan,
      selectedProducts: [
        {
          id: "prod-1",
          title: "Test Product",
          price: "$29.99",
          imageUrl: "https://test.com/product.jpg",
          url: "https://test.com/product",
          whyThisProduct: "Bestseller",
        },
      ],
      sections: [
        ...mockEmailPlan.sections.slice(0, 2),
        {
          id: "products",
          type: "product_grid" as const,
          purpose: "Featured products",
          productIds: ["prod-1"],
        },
        mockEmailPlan.sections[2],
      ],
    };

    vi.mocked(planEmail).mockResolvedValue(planWithProducts);

    const request = createMockRequest({
      brandContext: {
        ...mockBrandContext,
        catalog: [
          {
            id: "prod-1",
            title: "Test Product",
            price: "$29.99",
            image: "https://test.com/product.jpg",
            url: "https://test.com/product",
          },
        ],
      },
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.plan.selectedProducts).toHaveLength(1);
    expect(data.plan.selectedProducts[0].id).toBe("prod-1");
  });

  it("should handle complex campaign intent", async () => {
    vi.mocked(planEmail).mockResolvedValue(mockEmailPlan);

    const complexIntent: CampaignIntent = {
      type: "product_launch",
      goal: "Launch new product line",
      audience: "Loyal customers",
      offer: {
        kind: "percent",
        value: 20,
        details: "20% early bird discount",
      },
      urgency: "medium",
      timeWindow: {
        start: "2024-01-15T00:00:00Z",
        end: "2024-01-31T23:59:59Z",
      },
      tone: "premium",
      cta: {
        primary: "Pre-Order Now",
        secondary: "Learn More",
      },
      constraints: ["Highlight sustainability"],
      keywords: ["launch", "new", "sustainable"],
      confidence: 0.95,
      rationale: "Product launch campaign",
    };

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: complexIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.plan).toEqual(mockEmailPlan);
  });

  it("should not leak stack traces in error responses", async () => {
    const errorWithStack = new Error("Internal error");
    errorWithStack.stack = "This is a stack trace that should not be leaked";

    vi.mocked(planEmail).mockRejectedValue(errorWithStack);

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(data)).not.toContain("stack");
    expect(JSON.stringify(data)).not.toContain("This is a stack trace");
  });

  it("should handle INVALID_INPUT error from planEmail", async () => {
    vi.mocked(planEmail).mockRejectedValue(
      new LLMError("INVALID_INPUT", "Invalid input provided")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("should pass all fields from request to planEmail", async () => {
    vi.mocked(planEmail).mockResolvedValue(mockEmailPlan);

    const fullBrandContext: BrandContext = {
      brand: {
        name: "Full Brand",
        website: "https://full.com",
        logoUrl: "https://full.com/logo.png",
        colors: {
          primary: "#FF0000",
          background: "#FFFFFF",
          text: "#000000",
        },
        fonts: {
          heading: "Montserrat",
          body: "Open Sans",
        },
        voiceHints: ["bold", "innovative"],
        snippets: {
          tagline: "Innovation",
        },
      },
      catalog: [
        {
          id: "p1",
          title: "Product 1",
          price: "$99",
          image: "https://full.com/p1.jpg",
          url: "https://full.com/p1",
        },
      ],
      trust: {
        shipping: "Free shipping",
      },
    };

    const request = createMockRequest({
      brandContext: fullBrandContext,
      intent: mockIntent,
    });

    await POST(request);

    expect(planEmail).toHaveBeenCalledWith({
      brandContext: fullBrandContext,
      intent: mockIntent,
    });
  });
});
