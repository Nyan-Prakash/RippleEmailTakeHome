import { describe, it, expect, vi } from "vitest";
import { planEmail, type PlanEmailLLMClient } from "../planEmail";
import type { BrandContext } from "../../schemas/brand";
import type { CampaignIntent } from "../schemas/campaignIntent";
import { LLMError } from "../errors";

// Mock brand context for testing
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
    voiceHints: ["friendly", "professional"],
    snippets: {},
  },
  catalog: [
    {
      id: "prod-1",
      title: "Test Product 1",
      price: "$29.99",
      image: "https://test.com/img1.jpg",
      url: "https://test.com/product1",
    },
    {
      id: "prod-2",
      title: "Test Product 2",
      price: "$39.99",
      image: "https://test.com/img2.jpg",
      url: "https://test.com/product2",
    },
  ],
  trust: {},
};

const mockIntent: CampaignIntent = {
  type: "sale",
  goal: "Drive sales for end-of-season clearance",
  urgency: "high",
  tone: "urgent",
  cta: {
    primary: "Shop Now",
  },
  keywords: ["sale", "clearance", "limited"],
  confidence: 0.9,
  rationale: "Clear sale campaign with urgency",
};

describe("planEmail", () => {
  it("should successfully generate valid email plan", async () => {
    const mockOutput = {
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
          bodyGuidance: "sale ends tonight",
        },
        {
          id: "footer",
          type: "footer",
          purpose: "Legal",
        },
      ],
      selectedProducts: [],
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

    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi.fn().mockResolvedValue(JSON.stringify(mockOutput)),
    };

    const result = await planEmail({
      brandContext: mockBrandContext,
      intent: mockIntent,
      deps: { llm: mockLLM },
    });

    expect(result.subject.primary).toBe("50% Off Everything");
    expect(result.sections).toHaveLength(3);
    expect(result.confidence).toBe(0.92);
    expect(mockLLM.completeJson).toHaveBeenCalledOnce();
  });

  it("should handle plan with selected products", async () => {
    const mockOutput = {
      subject: {
        primary: "New Arrivals Just For You",
        alternatives: [],
      },
      preheader: "Check out our latest products",
      layout: {
        template: "hero_with_products",
        density: "medium",
      },
      sections: [
        {
          id: "header",
          type: "header",
          purpose: "Brand",
        },
        {
          id: "products",
          type: "product_grid",
          purpose: "Featured products",
          productIds: ["prod-1", "prod-2"],
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
          title: "Test Product 1",
          price: "$29.99",
          imageUrl: "https://test.com/img1.jpg",
          url: "https://test.com/product1",
          whyThisProduct: "Bestseller",
        },
        {
          id: "prod-2",
          title: "Test Product 2",
          price: "$39.99",
          whyThisProduct: "New arrival",
        },
      ],
      personalization: {
        level: "medium",
        ideas: ["Recommend based on browse history"],
      },
      compliance: {
        includeUnsubscribe: true,
        includePhysicalAddressHint: true,
      },
      confidence: 0.88,
      rationale: "Product showcase campaign",
    };

    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi.fn().mockResolvedValue(JSON.stringify(mockOutput)),
    };

    const result = await planEmail({
      brandContext: mockBrandContext,
      intent: mockIntent,
      deps: { llm: mockLLM },
    });

    expect(result.selectedProducts).toHaveLength(2);
    expect(result.selectedProducts[0].id).toBe("prod-1");
    expect(result.sections.some((s) => s.type === "product_grid")).toBe(true);
  });

  it("should handle empty catalog case with no products", async () => {
    const emptyBrandContext: BrandContext = {
      ...mockBrandContext,
      catalog: [],
    };

    const mockOutput = {
      subject: {
        primary: "Sale Ends Tonight",
        alternatives: [],
      },
      preheader: "Don't miss out",
      layout: {
        template: "announcement",
        density: "light",
      },
      sections: [
        {
          id: "header",
          type: "header",
          purpose: "Brand",
        },
        {
          id: "hero",
          type: "hero",
          purpose: "Announce sale",
        },
        {
          id: "footer",
          type: "footer",
          purpose: "Legal",
        },
      ],
      selectedProducts: [],
      personalization: {
        level: "none",
        ideas: [],
      },
      compliance: {
        includeUnsubscribe: true,
        includePhysicalAddressHint: true,
      },
      confidence: 0.85,
      rationale: "Simple announcement without products",
    };

    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi.fn().mockResolvedValue(JSON.stringify(mockOutput)),
    };

    const result = await planEmail({
      brandContext: emptyBrandContext,
      intent: mockIntent,
      deps: { llm: mockLLM },
    });

    expect(result.selectedProducts).toHaveLength(0);
    expect(
      result.sections.every((s) => !s.productIds || s.productIds.length === 0)
    ).toBe(true);
  });

  it("should throw LLM_FAILED when LLM call fails", async () => {
    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi.fn().mockRejectedValue(new Error("Network error")),
    };

    await expect(
      planEmail({
        brandContext: mockBrandContext,
        intent: mockIntent,
        deps: { llm: mockLLM },
      })
    ).rejects.toThrow(LLMError);
  });

  it("should throw LLM_TIMEOUT when LLM call times out", async () => {
    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi.fn().mockRejectedValue(new Error("Request timeout")),
    };

    await expect(
      planEmail({
        brandContext: mockBrandContext,
        intent: mockIntent,
        deps: { llm: mockLLM },
      })
    ).rejects.toThrow(LLMError);
  });

  it("should throw LLM_OUTPUT_INVALID when JSON parsing fails", async () => {
    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi.fn().mockResolvedValue("invalid json{{{"),
    };

    await expect(
      planEmail({
        brandContext: mockBrandContext,
        intent: mockIntent,
        deps: { llm: mockLLM },
      })
    ).rejects.toThrow(LLMError);
  });

  it("should attempt repair when first validation fails", async () => {
    const invalidOutput = {
      subject: {
        primary: "Test",
        alternatives: [],
      },
      preheader: "Test",
      layout: { template: "hero", density: "medium" },
      sections: [
        {
          id: "header",
          type: "header",
          purpose: "Brand",
        },
        // Missing footer - will fail validation
      ],
      selectedProducts: [],
      personalization: { level: "none", ideas: [] },
      compliance: {
        includeUnsubscribe: true,
        includePhysicalAddressHint: true,
      },
      confidence: 0.8,
      rationale: "Test",
    };

    const validOutput = {
      subject: {
        primary: "Repaired Plan",
        alternatives: [],
      },
      preheader: "Test",
      layout: { template: "hero", density: "medium" },
      sections: [
        {
          id: "header",
          type: "header",
          purpose: "Brand",
        },
        {
          id: "hero",
          type: "hero",
          purpose: "Main",
        },
        {
          id: "footer",
          type: "footer",
          purpose: "Legal",
        },
      ],
      selectedProducts: [],
      personalization: { level: "none", ideas: [] },
      compliance: {
        includeUnsubscribe: true,
        includePhysicalAddressHint: true,
      },
      confidence: 0.85,
      rationale: "Repaired output",
    };

    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi
        .fn()
        .mockResolvedValueOnce(JSON.stringify(invalidOutput))
        .mockResolvedValueOnce(JSON.stringify(validOutput)),
    };

    const result = await planEmail({
      brandContext: mockBrandContext,
      intent: mockIntent,
      deps: { llm: mockLLM },
    });

    expect(result.subject.primary).toBe("Repaired Plan");
    expect(mockLLM.completeJson).toHaveBeenCalledTimes(2);
  });

  it("should throw LLM_OUTPUT_INVALID when repair also fails", async () => {
    const invalidOutput = {
      subject: { primary: "Test", alternatives: [] },
      sections: [], // Invalid - too few sections
    };

    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi.fn().mockResolvedValue(JSON.stringify(invalidOutput)),
    };

    await expect(
      planEmail({
        brandContext: mockBrandContext,
        intent: mockIntent,
        deps: { llm: mockLLM },
      })
    ).rejects.toThrow(LLMError);

    expect(mockLLM.completeJson).toHaveBeenCalledTimes(2);
  });

  it("should use correct temperature for initial call", async () => {
    const mockOutput = {
      subject: { primary: "Test", alternatives: [] },
      preheader: "Test",
      layout: { template: "hero", density: "medium" },
      sections: [
        { id: "header", type: "header", purpose: "Brand" },
        { id: "hero", type: "hero", purpose: "Main" },
        { id: "footer", type: "footer", purpose: "Legal" },
      ],
      selectedProducts: [],
      personalization: { level: "none", ideas: [] },
      compliance: {
        includeUnsubscribe: true,
        includePhysicalAddressHint: true,
      },
      confidence: 0.8,
      rationale: "Test",
    };

    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi.fn().mockResolvedValue(JSON.stringify(mockOutput)),
    };

    await planEmail({
      brandContext: mockBrandContext,
      intent: mockIntent,
      deps: { llm: mockLLM },
    });

    const callArgs = vi.mocked(mockLLM.completeJson).mock.calls[0][0];
    expect(callArgs.temperature).toBe(0.7);
    expect(callArgs.timeoutMs).toBe(15000);
  });

  it("should use lower temperature for repair retry", async () => {
    const invalidOutput = {
      subject: { primary: "Test", alternatives: [] },
      sections: [{ id: "header", type: "header", purpose: "Brand" }],
    };

    const validOutput = {
      subject: { primary: "Test", alternatives: [] },
      preheader: "Test",
      layout: { template: "hero", density: "medium" },
      sections: [
        { id: "header", type: "header", purpose: "Brand" },
        { id: "hero", type: "hero", purpose: "Main" },
        { id: "footer", type: "footer", purpose: "Legal" },
      ],
      selectedProducts: [],
      personalization: { level: "none", ideas: [] },
      compliance: {
        includeUnsubscribe: true,
        includePhysicalAddressHint: true,
      },
      confidence: 0.8,
      rationale: "Test",
    };

    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi
        .fn()
        .mockResolvedValueOnce(JSON.stringify(invalidOutput))
        .mockResolvedValueOnce(JSON.stringify(validOutput)),
    };

    await planEmail({
      brandContext: mockBrandContext,
      intent: mockIntent,
      deps: { llm: mockLLM },
    });

    const repairCallArgs = vi.mocked(mockLLM.completeJson).mock.calls[1][0];
    expect(repairCallArgs.temperature).toBe(0.3);
  });

  it("should include brand context in system prompt", async () => {
    const mockOutput = {
      subject: { primary: "Test", alternatives: [] },
      preheader: "Test",
      layout: { template: "hero", density: "medium" },
      sections: [
        { id: "header", type: "header", purpose: "Brand" },
        { id: "hero", type: "hero", purpose: "Main" },
        { id: "footer", type: "footer", purpose: "Legal" },
      ],
      selectedProducts: [],
      personalization: { level: "none", ideas: [] },
      compliance: {
        includeUnsubscribe: true,
        includePhysicalAddressHint: true,
      },
      confidence: 0.8,
      rationale: "Test",
    };

    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi.fn().mockResolvedValue(JSON.stringify(mockOutput)),
    };

    await planEmail({
      brandContext: mockBrandContext,
      intent: mockIntent,
      deps: { llm: mockLLM },
    });

    const callArgs = vi.mocked(mockLLM.completeJson).mock.calls[0][0];
    expect(callArgs.system).toContain("Test Brand");
    expect(callArgs.system).toContain("friendly");
    expect(callArgs.system).toContain("professional");
  });

  it("should include catalog info in system prompt when catalog has items", async () => {
    const mockOutput = {
      subject: { primary: "Test", alternatives: [] },
      preheader: "Test",
      layout: { template: "hero", density: "medium" },
      sections: [
        { id: "header", type: "header", purpose: "Brand" },
        { id: "hero", type: "hero", purpose: "Main" },
        { id: "footer", type: "footer", purpose: "Legal" },
      ],
      selectedProducts: [],
      personalization: { level: "none", ideas: [] },
      compliance: {
        includeUnsubscribe: true,
        includePhysicalAddressHint: true,
      },
      confidence: 0.8,
      rationale: "Test",
    };

    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi.fn().mockResolvedValue(JSON.stringify(mockOutput)),
    };

    await planEmail({
      brandContext: mockBrandContext,
      intent: mockIntent,
      deps: { llm: mockLLM },
    });

    const callArgs = vi.mocked(mockLLM.completeJson).mock.calls[0][0];
    expect(callArgs.system).toContain("2 products available");
    expect(callArgs.system).toContain("prod-1");
    expect(callArgs.system).toContain("Test Product 1");
  });

  it("should warn about empty catalog in system prompt", async () => {
    const emptyBrandContext: BrandContext = {
      ...mockBrandContext,
      catalog: [],
    };

    const mockOutput = {
      subject: { primary: "Test", alternatives: [] },
      preheader: "Test",
      layout: { template: "hero", density: "medium" },
      sections: [
        { id: "header", type: "header", purpose: "Brand" },
        { id: "hero", type: "hero", purpose: "Main" },
        { id: "footer", type: "footer", purpose: "Legal" },
      ],
      selectedProducts: [],
      personalization: { level: "none", ideas: [] },
      compliance: {
        includeUnsubscribe: true,
        includePhysicalAddressHint: true,
      },
      confidence: 0.8,
      rationale: "Test",
    };

    const mockLLM: PlanEmailLLMClient = {
      completeJson: vi.fn().mockResolvedValue(JSON.stringify(mockOutput)),
    };

    await planEmail({
      brandContext: emptyBrandContext,
      intent: mockIntent,
      deps: { llm: mockLLM },
    });

    const callArgs = vi.mocked(mockLLM.completeJson).mock.calls[0][0];
    expect(callArgs.system).toContain("No products in catalog");
    expect(callArgs.system).toContain("EMPTY");
  });
});
