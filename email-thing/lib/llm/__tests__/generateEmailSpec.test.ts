import { describe, it, expect, vi } from "vitest";
import { generateEmailSpec } from "../generateEmailSpec";
import type { BrandContext } from "../../schemas/brand";
import type { CampaignIntent } from "../schemas/campaignIntent";
import type { EmailPlan } from "../schemas/emailPlan";
import { LLMError } from "../errors";

describe("generateEmailSpec", () => {
  const mockBrandContext: BrandContext = {
    brand: {
      name: "Test Brand",
      website: "https://testbrand.com",
      logoUrl: "https://testbrand.com/logo.png",
      colors: {
        primary: "#FF6B35",
        background: "#FFFFFF",
        text: "#111111",
      },
      fonts: {
        heading: "Helvetica",
        body: "Arial",
      },
      voiceHints: ["friendly", "approachable"],
      snippets: {},
    },
    catalog: [
      {
        id: "prod-1",
        title: "Test Product",
        price: "$99",
        image: "https://testbrand.com/product.jpg",
        url: "https://testbrand.com/product",
      },
    ],
    trust: {},
  };

  const mockIntent: CampaignIntent = {
    type: "sale",
    goal: "Drive sales with 50% off promotion",
    urgency: "high",
    tone: "urgent",
    cta: {
      primary: "Shop Now",
    },
    keywords: ["sale", "discount", "limited"],
    confidence: 0.9,
    rationale: "Clear sale intent",
  };

  const mockPlan: EmailPlan = {
    subject: {
      primary: "50% Off Everything!",
      alternatives: [],
    },
    preheader: "Limited time sale ends tonight",
    layout: {
      template: "hero",
      density: "medium",
    },
    sections: [
      {
        id: "header",
        type: "header",
        purpose: "Brand header with logo",
      },
      {
        id: "hero",
        type: "hero",
        purpose: "Promote the sale",
        headline: "50% Off Everything",
      },
      {
        id: "footer",
        type: "footer",
        purpose: "Footer with links",
      },
    ],
    selectedProducts: [
      {
        id: "prod-1",
        title: "Test Product",
        price: "$99",
        whyThisProduct: "Best seller",
      },
    ],
    personalization: {
      level: "light",
      ideas: [],
    },
    compliance: {
      includeUnsubscribe: true,
      includePhysicalAddressHint: true,
    },
    confidence: 0.9,
    rationale: "Good match",
  };

  it("generates valid EmailSpec with mocked LLM", async () => {
    const mockLLM = {
      completeJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          meta: {
            subject: "50% Off Everything!",
            preheader: "Limited time sale ends tonight",
          },
          theme: {
            containerWidth: 600,
            backgroundColor: "#FFFFFF",
            surfaceColor: "#F5F5F5",
            textColor: "#111111",
            mutedTextColor: "#666666",
            primaryColor: "#FF6B35",
            font: {
              heading: "Helvetica",
              body: "Arial",
            },
            button: {
              radius: 8,
              style: "solid",
            },
          },
          sections: [
            {
              id: "header",
              type: "header",
              blocks: [
                {
                  type: "logo",
                  src: "https://testbrand.com/logo.png",
                  align: "center",
                },
              ],
            },
            {
              id: "hero",
              type: "hero",
              blocks: [
                {
                  type: "heading",
                  text: "50% Off Everything",
                  level: 1,
                  align: "center",
                },
                {
                  type: "paragraph",
                  text: "Limited time sale ends tonight",
                  align: "center",
                },
                {
                  type: "button",
                  text: "Shop Now",
                  href: "https://testbrand.com",
                  align: "center",
                },
              ],
            },
            {
              id: "footer",
              type: "footer",
              blocks: [
                {
                  type: "smallPrint",
                  text: "Unsubscribe anytime",
                  align: "center",
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
                image: "https://testbrand.com/product.jpg",
                url: "https://testbrand.com/product",
              },
            ],
          },
        })
      ),
    };

    const spec = await generateEmailSpec({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
      deps: { llm: mockLLM },
    });

    expect(spec).toBeDefined();
    expect(spec.meta.subject).toBe("50% Off Everything!");
    expect(spec.sections).toHaveLength(3);
    expect(spec.sections[0].type).toBe("header");
    expect(spec.sections[2].type).toBe("footer");
    expect(mockLLM.completeJson).toHaveBeenCalledTimes(1);
  });

  it("handles invalid JSON output", async () => {
    const mockLLM = {
      completeJson: vi.fn().mockResolvedValue("invalid json{"),
    };

    await expect(
      generateEmailSpec({
        brandContext: mockBrandContext,
        intent: mockIntent,
        plan: mockPlan,
        deps: { llm: mockLLM },
      })
    ).rejects.toThrow(LLMError);
  });

  it("retries on validation failure and succeeds", async () => {
    const mockLLM = {
      completeJson: vi
        .fn()
        .mockResolvedValueOnce(
          JSON.stringify({
            meta: {
              subject: "Test",
              preheader: "Test preheader",
            },
            sections: [
              // Missing header and footer - invalid
              {
                id: "hero",
                type: "hero",
                blocks: [],
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            meta: {
              subject: "50% Off Everything!",
              preheader: "Limited time sale ends tonight",
            },
            theme: {
              containerWidth: 600,
              backgroundColor: "#FFFFFF",
              surfaceColor: "#F5F5F5",
              textColor: "#111111",
              mutedTextColor: "#666666",
              primaryColor: "#FF6B35",
              font: {
                heading: "Helvetica",
                body: "Arial",
              },
              button: {
                radius: 8,
                style: "solid",
              },
            },
            sections: [
              {
                id: "header",
                type: "header",
                blocks: [],
              },
              {
                id: "hero",
                type: "hero",
                blocks: [
                  {
                    type: "button",
                    text: "Click",
                    href: "https://testbrand.com",
                  },
                ],
              },
              {
                id: "footer",
                type: "footer",
                blocks: [],
              },
            ],
            catalog: {
              items: [],
            },
          })
        ),
    };

    const spec = await generateEmailSpec({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
      deps: { llm: mockLLM },
    });

    expect(spec).toBeDefined();
    expect(mockLLM.completeJson).toHaveBeenCalledTimes(2);
  });

  it("throws LLM_OUTPUT_INVALID after failed retry", async () => {
    const mockLLM = {
      completeJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          meta: {
            subject: "Test",
            preheader: "Test preheader",
          },
          sections: [
            // Missing header/footer - always invalid
            {
              id: "hero",
              type: "hero",
              blocks: [],
            },
          ],
        })
      ),
    };

    await expect(
      generateEmailSpec({
        brandContext: mockBrandContext,
        intent: mockIntent,
        plan: mockPlan,
        deps: { llm: mockLLM },
      })
    ).rejects.toThrow(LLMError);

    expect(mockLLM.completeJson).toHaveBeenCalledTimes(2); // Initial + retry
  });

  it("validates catalog is empty - no productCard blocks", async () => {
    const noCatalogBrand: BrandContext = {
      ...mockBrandContext,
      catalog: [],
    };

    const mockLLM = {
      completeJson: vi.fn().mockResolvedValue(
        JSON.stringify({
          meta: {
            subject: "50% Off Everything!",
            preheader: "Limited time sale ends tonight",
          },
          theme: {
            containerWidth: 600,
            backgroundColor: "#FFFFFF",
            surfaceColor: "#F5F5F5",
            textColor: "#111111",
            mutedTextColor: "#666666",
            primaryColor: "#FF6B35",
            font: {
              heading: "Helvetica",
              body: "Arial",
            },
            button: {
              radius: 8,
              style: "solid",
            },
          },
          sections: [
            {
              id: "header",
              type: "header",
              blocks: [],
            },
            {
              id: "hero",
              type: "hero",
              blocks: [
                {
                  type: "button",
                  text: "Shop Now",
                  href: "https://testbrand.com",
                },
              ],
            },
            {
              id: "footer",
              type: "footer",
              blocks: [],
            },
          ],
          catalog: {
            items: [],
          },
        })
      ),
    };

    const spec = await generateEmailSpec({
      brandContext: noCatalogBrand,
      intent: mockIntent,
      plan: mockPlan,
      deps: { llm: mockLLM },
    });

    expect(spec).toBeDefined();
    expect(spec.catalog?.items).toHaveLength(0);
    // Ensure no productCard blocks
    const hasProductCard = spec.sections.some((s) =>
      s.blocks.some((b) => b.type === "productCard")
    );
    expect(hasProductCard).toBe(false);
  });
});
