import { describe, it, expect, vi } from "vitest";
import { generateEmailSpec } from "../generateEmailSpec";
import type { BrandContext } from "../../schemas/brand";
import type { CampaignIntent } from "../../schemas/campaign";
import type { EmailPlan } from "../../schemas/plan";
import { LLMError } from "../errors";

describe("generateEmailSpec", () => {
  const mockBrandContext: BrandContext = {
    brand: {
      name: "Test Brand",
      website: "https://test.com",
      logoUrl: "https://test.com/logo.png",
      colors: {
        primary: "#FF5733",
        background: "#FFFFFF",
        text: "#111111",
      },
      fonts: {
        heading: "Arial",
        body: "Arial",
      },
      voiceHints: ["professional", "friendly"],
      snippets: {
        tagline: "Quality products",
        ctas: ["Shop Now", "Learn More"],
      },
    },
    catalog: [
      {
        id: "product-1",
        title: "Test Product",
        price: "$99",
        image: "https://test.com/product.jpg",
        url: "https://test.com/product",
      },
    ],
    trust: {},
  };

  const mockIntent: CampaignIntent = {
    type: "sale",
    tone: "premium",
    offer: "20% off",
    ctaText: "Shop Now",
  };

  const mockPlan: EmailPlan = {
    campaignType: "sale",
    goal: "Drive sales with discount offer",
    sections: [
      { type: "header" },
      { type: "hero" },
      { type: "productGrid", count: 2 },
      { type: "footer" },
    ],
  };

  it("should generate valid EmailSpec with mocked LLM on first attempt", async () => {
    const validSpec = {
      meta: {
        subject: "20% Off Sale - Test Brand",
        preheader: "Don't miss our exclusive sale",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#FF5733",
        font: {
          heading: "Arial",
          body: "Arial",
        },
        button: {
          radius: 8,
          style: "solid" as const,
        },
      },
      sections: [
        {
          id: "header-1",
          type: "header" as const,
          blocks: [
            {
              type: "logo" as const,
              src: "https://test.com/logo.png",
            },
          ],
        },
        {
          id: "hero-1",
          type: "hero" as const,
          blocks: [
            {
              type: "heading" as const,
              text: "20% Off Everything",
              level: 1,
            },
            {
              type: "button" as const,
              text: "Shop Now",
              href: "https://test.com/shop",
            },
          ],
        },
        {
          id: "products-1",
          type: "productGrid" as const,
          blocks: [
            {
              type: "productCard" as const,
              productRef: "product-1",
            },
          ],
        },
        {
          id: "footer-1",
          type: "footer" as const,
          blocks: [
            {
              type: "smallPrint" as const,
              text: "{{unsubscribe}}",
            },
          ],
        },
      ],
      catalog: {
        items: mockBrandContext.catalog,
      },
    };

    const mockLLM = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify(validSpec),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await generateEmailSpec({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
      llmClient: mockLLM as any,
    });

    expect(result.spec).toBeDefined();
    expect(result.spec.meta.subject).toBe(validSpec.meta.subject);
    expect(result.warnings).toBeDefined();
    expect(mockLLM.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it("should converge on 2nd attempt after Zod error", async () => {
    const invalidSpec = {
      meta: {
        subject: "Test",
        // Missing preheader
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#FF5733",
        font: {
          heading: "Arial",
          body: "Arial",
        },
        button: {
          radius: 8,
          style: "solid",
        },
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
            { type: "heading", text: "Test", level: 1 },
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

    const validSpec = {
      ...invalidSpec,
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
    };

    let callCount = 0;
    const mockLLM = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({
                choices: [{ message: { content: JSON.stringify(invalidSpec) } }],
              });
            }
            return Promise.resolve({
              choices: [{ message: { content: JSON.stringify(validSpec) } }],
            });
          }),
        },
      },
    };

    const result = await generateEmailSpec({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
      llmClient: mockLLM as any,
    });

    expect(result.spec).toBeDefined();
    expect(result.spec.meta.preheader).toBe("Test preheader text");
    expect(mockLLM.chat.completions.create).toHaveBeenCalledTimes(2);
    
    // Check that temperature decreased
    const firstCall = mockLLM.chat.completions.create.mock.calls[0][0];
    const secondCall = mockLLM.chat.completions.create.mock.calls[1][0];
    expect(firstCall.temperature).toBe(0.7);
    expect(secondCall.temperature).toBe(0.5);
  });

  it("should converge on 3rd attempt after structural error", async () => {
    const specWithBadOrder = {
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
        primaryColor: "#FF5733",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" },
      },
      sections: [
        {
          id: "hero-1",
          type: "hero",
          blocks: [
            { type: "heading", text: "Test", level: 1 },
            { type: "button", text: "Shop Now", href: "https://test.com" },
          ],
        },
        {
          id: "header-1",
          type: "header",
          blocks: [{ type: "logo", src: "https://test.com/logo.png" }],
        },
        {
          id: "footer-1",
          type: "footer",
          blocks: [{ type: "smallPrint", text: "{{unsubscribe}}" }],
        },
      ],
    };

    const specMissingButton = {
      ...specWithBadOrder,
      sections: [
        specWithBadOrder.sections[1], // header
        {
          id: "hero-2",
          type: "hero",
          blocks: [{ type: "heading", text: "Test", level: 1 }], // No button
        },
        specWithBadOrder.sections[2], // footer
      ],
    };

    const fixedSpec = {
      ...specWithBadOrder,
      sections: [
        specWithBadOrder.sections[1], // header first
        specWithBadOrder.sections[0], // hero
        specWithBadOrder.sections[2], // footer last
      ],
    };

    let callCount = 0;
    const mockLLM = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // First attempt: wrong order
              return Promise.resolve({
                choices: [{ message: { content: JSON.stringify(specWithBadOrder) } }],
              });
            } else if (callCount === 2) {
              // Second attempt: different error (missing button)
              return Promise.resolve({
                choices: [{ message: { content: JSON.stringify(specMissingButton) } }],
              });
            }
            // Third attempt: success
            return Promise.resolve({
              choices: [{ message: { content: JSON.stringify(fixedSpec) } }],
            });
          }),
        },
      },
    };

    const result = await generateEmailSpec({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
      llmClient: mockLLM as any,
    });

    expect(result.spec).toBeDefined();
    expect(result.spec.sections[0].type).toBe("header");
    expect(result.spec.sections[result.spec.sections.length - 1].type).toBe("footer");
    // With repeated error detection, it retries once then fixes on 3rd attempt
    expect(mockLLM.chat.completions.create).toHaveBeenCalled();
    expect(mockLLM.chat.completions.create.mock.calls.length).toBeGreaterThanOrEqual(2);
    
    // Check that temperature decreased to minimum
    const thirdCall = mockLLM.chat.completions.create.mock.calls[2][0];
    expect(thirdCall.temperature).toBe(0.3);
  });

  it("should fail after max attempts with same error", async () => {
    const invalidSpec = {
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
        primaryColor: "#FF5733",
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
          blocks: [{ type: "heading", text: "Test", level: 1 }],
          // Missing button - will always fail
        },
        {
          id: "footer-1",
          type: "footer",
          blocks: [{ type: "smallPrint", text: "{{unsubscribe}}" }],
        },
      ],
    };

    const mockLLM = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(invalidSpec) } }],
          }),
        },
      },
    };

    await expect(
      generateEmailSpec({
        brandContext: mockBrandContext,
        intent: mockIntent,
        plan: mockPlan,
        llmClient: mockLLM as any,
      })
    ).rejects.toThrow(LLMError);

    // With repeated error detection, it should fail after detecting the same error twice (2 attempts)
    expect(mockLLM.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it("should return warnings for non-blocking issues", async () => {
    const specWithWarnings = {
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
        primaryColor: "#0000FF", // Different from brand primary
        font: { heading: "Comic Sans", body: "Arial" }, // Different font
        button: { radius: 8, style: "solid" },
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
            { type: "heading", text: "Test", level: 1 },
            { type: "button", text: "Shop Now", href: "https://test.com" },
          ],
        },
        // Many sections for content imbalance warning
        { id: "feature-1", type: "feature", blocks: [] },
        { id: "feature-2", type: "feature", blocks: [] },
        { id: "feature-3", type: "feature", blocks: [] },
        { id: "feature-4", type: "feature", blocks: [] },
        { id: "feature-5", type: "feature", blocks: [] },
        { id: "feature-6", type: "feature", blocks: [] },
        {
          id: "footer-1",
          type: "footer",
          blocks: [{ type: "smallPrint", text: "{{unsubscribe}}" }],
        },
      ],
    };

    const mockLLM = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(specWithWarnings) } }],
          }),
        },
      },
    };

    const result = await generateEmailSpec({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
      llmClient: mockLLM as any,
    });

    expect(result.spec).toBeDefined();
    expect(result.warnings.length).toBeGreaterThan(0);
    
    // Should have theme drift and too many sections warnings
    expect(result.warnings.some(w => w.code === "THEME_COLOR_DRIFT")).toBe(true);
    expect(result.warnings.some(w => w.code === "TOO_MANY_SECTIONS")).toBe(true);
  });

  it("should handle invalid JSON", async () => {
    const mockLLM = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "{ invalid json" } }],
          }),
        },
      },
    };

    await expect(
      generateEmailSpec({
        brandContext: mockBrandContext,
        intent: mockIntent,
        plan: mockPlan,
        llmClient: mockLLM as any,
      })
    ).rejects.toThrow(LLMError);
  });

  it("should throw error when LLM client is missing", async () => {
    await expect(
      generateEmailSpec({
        brandContext: mockBrandContext,
        intent: mockIntent,
        plan: mockPlan,
        // No llmClient
      } as any)
    ).rejects.toThrow(LLMError);
  });
});
