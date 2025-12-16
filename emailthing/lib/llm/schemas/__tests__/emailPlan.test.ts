import { describe, it, expect } from "vitest";
import { EmailPlanSchema } from "../emailPlan";

describe("EmailPlanSchema", () => {
  const createValidPlan = () => ({
    subject: {
      primary: "Get 50% Off Everything",
      alternatives: ["Save Big Today", "Flash Sale Ends Tonight"],
    },
    preheader: "Limited time offer - Shop now before it's gone!",
    layout: {
      template: "hero" as const,
      density: "medium" as const,
    },
    sections: [
      {
        id: "header",
        type: "header" as const,
        purpose: "Brand identity and navigation",
        styleHints: ["clean", "minimal"],
      },
      {
        id: "hero-section",
        type: "hero" as const,
        purpose: "Showcase the main sale offer",
        headline: "50% Off Everything",
        bodyGuidance: "Emphasize urgency and savings with bold copy",
        cta: {
          label: "Shop Now",
          hrefHint: "Link to sale collection page",
        },
      },
      {
        id: "footer",
        type: "footer" as const,
        purpose: "Legal links and contact info",
      },
    ],
    selectedProducts: [],
    personalization: {
      level: "light" as const,
      ideas: ["Use customer's first name", "Show relevant category"],
    },
    compliance: {
      includeUnsubscribe: true as const,
      includePhysicalAddressHint: true as const,
      claimsToAvoid: ["Guarantee", "Risk-free"],
    },
    confidence: 0.92,
    rationale: "Strong sale campaign with clear urgency and compelling offer",
  });

  it("should validate a complete valid email plan", () => {
    const validPlan = createValidPlan();
    const result = EmailPlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
  });

  it("should validate plan with products", () => {
    const planWithProducts = {
      ...createValidPlan(),
      selectedProducts: [
        {
          id: "prod-1",
          title: "Premium Wool Sweater",
          price: "$89.99",
          imageUrl: "https://example.com/sweater.jpg",
          url: "https://example.com/products/sweater",
          whyThisProduct: "Bestseller in winter collection",
        },
        {
          id: "prod-2",
          title: "Organic Cotton T-Shirt",
          price: "$29.99",
          whyThisProduct: "Popular sustainable option",
        },
      ],
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
        },
        {
          id: "products",
          type: "product_grid" as const,
          purpose: "Featured products",
          productIds: ["prod-1", "prod-2"],
        },
        {
          id: "footer",
          type: "footer" as const,
          purpose: "Legal",
        },
      ],
    };

    const result = EmailPlanSchema.safeParse(planWithProducts);
    expect(result.success).toBe(true);
  });

  it("should reject plan without header section", () => {
    const invalidPlan = {
      ...createValidPlan(),
      sections: [
        {
          id: "hero",
          type: "hero" as const,
          purpose: "Main content",
        },
        {
          id: "footer",
          type: "footer" as const,
          purpose: "Legal",
        },
      ],
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("header");
    }
  });

  it("should reject plan without footer section", () => {
    const invalidPlan = {
      ...createValidPlan(),
      sections: [
        {
          id: "header",
          type: "header" as const,
          purpose: "Brand",
        },
        {
          id: "hero",
          type: "hero" as const,
          purpose: "Main content",
        },
      ],
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("footer");
    }
  });

  it("should reject productIds referencing non-existent products", () => {
    const invalidPlan = {
      ...createValidPlan(),
      selectedProducts: [
        {
          id: "prod-1",
          title: "Test Product",
          whyThisProduct: "Test reason",
        },
      ],
      sections: [
        {
          id: "header",
          type: "header" as const,
          purpose: "Brand",
        },
        {
          id: "products",
          type: "product_grid" as const,
          purpose: "Products",
          productIds: ["prod-1", "prod-999"], // prod-999 doesn't exist
        },
        {
          id: "footer",
          type: "footer" as const,
          purpose: "Legal",
        },
      ],
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("prod-999");
    }
  });

  it("should reject sections with productIds when selectedProducts is empty", () => {
    const invalidPlan = {
      ...createValidPlan(),
      selectedProducts: [],
      sections: [
        {
          id: "header",
          type: "header" as const,
          purpose: "Brand",
        },
        {
          id: "products",
          type: "product_grid" as const,
          purpose: "Products",
          productIds: ["prod-1"],
        },
        {
          id: "footer",
          type: "footer" as const,
          purpose: "Legal",
        },
      ],
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("productIds");
    }
  });

  it("should reject product_grid template with product sections when selectedProducts is empty", () => {
    const invalidPlan = {
      ...createValidPlan(),
      layout: {
        template: "product_grid" as const,
        density: "medium" as const,
      },
      selectedProducts: [],
      sections: [
        {
          id: "header",
          type: "header" as const,
          purpose: "Brand",
        },
        {
          id: "products",
          type: "product_grid" as const,
          purpose: "Products",
        },
        {
          id: "footer",
          type: "footer" as const,
          purpose: "Legal",
        },
      ],
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
  });

  it("should reject subject primary exceeding 70 characters", () => {
    const invalidPlan = {
      ...createValidPlan(),
      subject: {
        primary: "A".repeat(71),
        alternatives: [],
      },
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
  });

  it("should reject more than 3 alternative subjects", () => {
    const invalidPlan = {
      ...createValidPlan(),
      subject: {
        primary: "Main Subject",
        alternatives: ["Alt 1", "Alt 2", "Alt 3", "Alt 4"],
      },
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
  });

  it("should reject preheader exceeding 110 characters", () => {
    const invalidPlan = {
      ...createValidPlan(),
      preheader: "A".repeat(111),
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
  });

  it("should reject fewer than 3 sections", () => {
    const invalidPlan = {
      ...createValidPlan(),
      sections: [
        {
          id: "header",
          type: "header" as const,
          purpose: "Brand",
        },
        {
          id: "footer",
          type: "footer" as const,
          purpose: "Legal",
        },
      ],
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
  });

  it("should reject more than 10 sections", () => {
    const invalidPlan = {
      ...createValidPlan(),
      sections: Array(11)
        .fill(null)
        .map((_, i) => ({
          id: `section-${i}`,
          type:
            i === 0
              ? ("header" as const)
              : i === 10
                ? ("footer" as const)
                : ("hero" as const),
          purpose: "Test",
        })),
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
  });

  it("should reject more than 8 selected products", () => {
    const invalidPlan = {
      ...createValidPlan(),
      selectedProducts: Array(9)
        .fill(null)
        .map((_, i) => ({
          id: `prod-${i}`,
          title: `Product ${i}`,
          whyThisProduct: "Test",
        })),
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
  });

  it("should validate all valid template types", () => {
    const templates = [
      "hero",
      "hero_with_products",
      "product_grid",
      "editorial",
      "announcement",
      "newsletter",
      "minimal",
    ] as const;

    templates.forEach((template) => {
      const plan = {
        ...createValidPlan(),
        layout: { template, density: "medium" as const },
      };

      const result = EmailPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });
  });

  it("should validate all valid density levels", () => {
    const densities = ["light", "medium", "high"] as const;

    densities.forEach((density) => {
      const plan = {
        ...createValidPlan(),
        layout: { template: "hero" as const, density },
      };

      const result = EmailPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });
  });

  it("should validate all valid section types", () => {
    const types = [
      "header",
      "hero",
      "value_props",
      "product_feature",
      "product_grid",
      "social_proof",
      "promo_banner",
      "faq",
      "footer",
    ] as const;

    types.forEach((type) => {
      const plan = {
        ...createValidPlan(),
        sections: [
          { id: "header", type: "header" as const, purpose: "Brand" },
          { id: "test", type, purpose: "Test section" },
          { id: "footer", type: "footer" as const, purpose: "Legal" },
        ],
      };

      const result = EmailPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });
  });

  it("should validate all valid personalization levels", () => {
    const levels = ["none", "light", "medium"] as const;

    levels.forEach((level) => {
      const plan = {
        ...createValidPlan(),
        personalization: { level, ideas: [] },
      };

      const result = EmailPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });
  });

  it("should reject confidence outside 0-1 range", () => {
    const invalidPlan = {
      ...createValidPlan(),
      confidence: 1.5,
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
  });

  it("should reject rationale exceeding 220 characters", () => {
    const invalidPlan = {
      ...createValidPlan(),
      rationale: "A".repeat(221),
    };

    const result = EmailPlanSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
  });
});
