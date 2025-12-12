import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";
import type { BrandContext } from "../../../../../lib/schemas/brand";
import type { CampaignIntent } from "../../../../../lib/llm/schemas/campaignIntent";
import type { EmailPlan } from "../../../../../lib/llm/schemas/emailPlan";

// Mock the generateEmailSpec module
vi.mock("../../../../../lib/llm/generateEmailSpec", () => ({
  generateEmailSpec: vi.fn(),
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

import { generateEmailSpec } from "../../../../../lib/llm/generateEmailSpec";
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
  catalog: [
    {
      id: "prod-1",
      title: "Test Product",
      price: "$99",
      image: "https://test.com/prod.jpg",
      url: "https://test.com/prod",
    },
  ],
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

const mockEmailPlan: EmailPlan = {
  subject: {
    primary: "50% Off Everything",
    alternatives: ["Save Big Today"],
  },
  preheader: "Limited time offer",
  layout: {
    template: "hero",
    density: "medium",
  },
  sections: [
    {
      id: "header",
      type: "header",
      purpose: "Brand identity",
    },
    {
      id: "hero",
      type: "hero",
      purpose: "Main offer",
      headline: "50% Off",
    },
    {
      id: "footer",
      type: "footer",
      purpose: "Legal",
    },
  ],
  selectedProducts: [
    {
      id: "prod-1",
      title: "Test Product",
      price: "$99",
      whyThisProduct: "Bestseller",
    },
  ],
  personalization: {
    level: "light",
    ideas: ["Use first name"],
  },
  compliance: {
    includeUnsubscribe: true,
    includePhysicalAddressHint: true,
  },
  confidence: 0.92,
  rationale: "Strong sale campaign",
};

const mockEmailSpec = {
  meta: {
    subject: "50% Off Everything",
    preheader: "Limited time offer",
  },
  theme: {
    containerWidth: 600,
    backgroundColor: "#FFFFFF",
    surfaceColor: "#F5F5F5",
    textColor: "#111111",
    mutedTextColor: "#666666",
    primaryColor: "#000000",
    font: {
      heading: "Arial",
      body: "Helvetica",
    },
    button: {
      radius: 8,
      style: "solid" as const,
    },
  },
  sections: [
    {
      id: "header",
      type: "header" as const,
      blocks: [
        {
          type: "logo" as const,
          src: "https://test.com/logo.png",
        },
      ],
    },
    {
      id: "hero",
      type: "hero" as const,
      blocks: [
        {
          type: "heading" as const,
          text: "50% Off Everything",
          level: 1 as const,
        },
        {
          type: "button" as const,
          text: "Shop Now",
          href: "https://test.com",
        },
      ],
    },
    {
      id: "footer",
      type: "footer" as const,
      blocks: [
        {
          type: "smallPrint" as const,
          text: "Unsubscribe",
        },
      ],
    },
  ],
  catalog: {
    items: [
      {
        id: "prod-1",
        title: "Test Product",
        price: "$99",
        image: "https://test.com/prod.jpg",
        url: "https://test.com/prod",
      },
    ],
  },
};

function createMockRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/email/spec", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/email/spec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with valid request", async () => {
    vi.mocked(generateEmailSpec).mockResolvedValue(mockEmailSpec);

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockEmailPlan,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spec).toEqual(mockEmailSpec);
    expect(generateEmailSpec).toHaveBeenCalledWith({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockEmailPlan,
    });
  });

  it("should return 400 for missing brandContext", async () => {
    const request = createMockRequest({
      intent: mockIntent,
      plan: mockEmailPlan,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
    expect(generateEmailSpec).not.toHaveBeenCalled();
  });

  it("should return 400 for missing intent", async () => {
    const request = createMockRequest({
      brandContext: mockBrandContext,
      plan: mockEmailPlan,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
    expect(generateEmailSpec).not.toHaveBeenCalled();
  });

  it("should return 400 for missing plan", async () => {
    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
    expect(generateEmailSpec).not.toHaveBeenCalled();
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
      plan: mockEmailPlan,
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
      plan: mockEmailPlan,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("should return 400 for invalid plan schema", async () => {
    const invalidPlan = {
      subject: "Test",
      // Missing required fields
    };

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: invalidPlan,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("should return 500 for LLM_CONFIG_MISSING error", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(
      new LLMError("LLM_CONFIG_MISSING", "LLM API configuration is missing")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockEmailPlan,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("LLM_CONFIG_MISSING");
  });

  it("should return 502 for LLM_FAILED error", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(
      new LLMError("LLM_FAILED", "Failed to generate response from LLM")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockEmailPlan,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("LLM_FAILED");
  });

  it("should return 504 for LLM_TIMEOUT error", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(
      new LLMError("LLM_TIMEOUT", "LLM request timed out")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockEmailPlan,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.error.code).toBe("LLM_TIMEOUT");
  });

  it("should return 502 for LLM_OUTPUT_INVALID error", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(
      new LLMError("LLM_OUTPUT_INVALID", "LLM output could not be validated")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockEmailPlan,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("LLM_OUTPUT_INVALID");
  });

  it("should return 500 for unexpected errors", async () => {
    vi.mocked(generateEmailSpec).mockRejectedValue(
      new Error("Unexpected error")
    );

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockEmailPlan,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("INTERNAL");
    expect(data.error.message).toBe("An unexpected error occurred");
  });

  it("should not leak stack traces in error responses", async () => {
    const errorWithStack = new Error("Internal error");
    errorWithStack.stack = "This is a stack trace that should not be leaked";

    vi.mocked(generateEmailSpec).mockRejectedValue(errorWithStack);

    const request = createMockRequest({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockEmailPlan,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(data)).not.toContain("stack");
    expect(JSON.stringify(data)).not.toContain("This is a stack trace");
  });

  it("should handle spec with empty catalog", async () => {
    const specWithoutCatalog = {
      ...mockEmailSpec,
      catalog: {
        items: [],
      },
    };

    vi.mocked(generateEmailSpec).mockResolvedValue(specWithoutCatalog);

    const request = createMockRequest({
      brandContext: { ...mockBrandContext, catalog: [] },
      intent: mockIntent,
      plan: { ...mockEmailPlan, selectedProducts: [] },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spec.catalog.items).toHaveLength(0);
  });

  it("should pass all fields from request to generateEmailSpec", async () => {
    vi.mocked(generateEmailSpec).mockResolvedValue(mockEmailSpec);

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
      plan: mockEmailPlan,
    });

    await POST(request);

    expect(generateEmailSpec).toHaveBeenCalledWith({
      brandContext: fullBrandContext,
      intent: mockIntent,
      plan: mockEmailPlan,
    });
  });
});
