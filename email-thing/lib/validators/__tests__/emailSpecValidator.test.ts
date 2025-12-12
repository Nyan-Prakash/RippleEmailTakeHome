import { describe, it, expect } from "vitest";
import { validateEmailSpecStructure } from "../emailSpec";
import type { EmailSpec } from "../../schemas/emailSpec";
import type { BrandContext } from "../../schemas/brand";
import type { CampaignIntent } from "../../schemas/campaign";
import type { EmailPlan } from "../../schemas/plan";

describe("validateEmailSpecStructure", () => {
  const mockBrandContext: BrandContext = {
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

  const mockIntent: CampaignIntent = {
    type: "sale",
    tone: "premium",
  };

  const mockPlan: EmailPlan = {
    campaignType: "sale",
    goal: "Drive sales",
    sections: [{ type: "header" }, { type: "hero" }, { type: "footer" }],
  };

  it("should pass validation for a valid EmailSpec", () => {
    const validSpec: EmailSpec = {
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
          blocks: [
            {
              type: "logo",
              src: "https://test.com/logo.png",
            },
          ],
        },
        {
          id: "hero-1",
          type: "hero",
          blocks: [
            { type: "heading", text: "Welcome", level: 1 },
            {
              type: "button",
              text: "Shop Now",
              href: "https://test.com/shop",
            },
          ],
        },
        {
          id: "footer-1",
          type: "footer",
          blocks: [
            {
              type: "smallPrint",
              text: "{{unsubscribe}}",
              align: "center",
            },
          ],
        },
      ],
    };

    const result = validateEmailSpecStructure({
      spec: validSpec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    expect(result.ok).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("should fail when header is not first section", () => {
    const invalidSpec: EmailSpec = {
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
        button: { radius: 8, style: "solid" },
      },
      sections: [
        {
          id: "hero-1",
          type: "hero",
          blocks: [{ type: "heading", text: "Welcome", level: 1 }],
        },
        {
          id: "header-1",
          type: "header",
          blocks: [],
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

    const result = validateEmailSpecStructure({
      spec: invalidSpec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    expect(result.ok).toBe(false);
    const headerError = result.issues.find(
      (i) => i.code === "HEADER_NOT_FIRST"
    );
    expect(headerError).toBeDefined();
    expect(headerError?.severity).toBe("error");
  });

  it("should fail when footer is not last section", () => {
    const invalidSpec: EmailSpec = {
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
        button: { radius: 8, style: "solid" },
      },
      sections: [
        {
          id: "header-1",
          type: "header",
          blocks: [],
        },
        {
          id: "footer-1",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}", align: "center" },
          ],
        },
        {
          id: "hero-1",
          type: "hero",
          blocks: [{ type: "heading", text: "Welcome", level: 1 }],
        },
      ],
    };

    const result = validateEmailSpecStructure({
      spec: invalidSpec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    expect(result.ok).toBe(false);
    const footerError = result.issues.find((i) => i.code === "FOOTER_NOT_LAST");
    expect(footerError).toBeDefined();
    expect(footerError?.severity).toBe("error");
  });

  it("should fail when logo has missing src", () => {
    const invalidSpec: EmailSpec = {
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
        button: { radius: 8, style: "solid" },
      },
      sections: [
        {
          id: "header-1",
          type: "header",
          blocks: [
            {
              type: "logo",
              src: "",
            },
          ],
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

    const result = validateEmailSpecStructure({
      spec: invalidSpec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    expect(result.ok).toBe(false);
    const logoError = result.issues.find((i) => i.code === "LOGO_MISSING_SRC");
    expect(logoError).toBeDefined();
    expect(logoError?.severity).toBe("error");
  });

  it("should fail when no valid CTA button exists", () => {
    const invalidSpec: EmailSpec = {
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
          blocks: [{ type: "heading", text: "Welcome", level: 1 }],
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

    const result = validateEmailSpecStructure({
      spec: invalidSpec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    expect(result.ok).toBe(false);
    const ctaError = result.issues.find((i) => i.code === "MISSING_VALID_CTA");
    expect(ctaError).toBeDefined();
    expect(ctaError?.severity).toBe("error");
  });

  it("should fail when productCard references non-existent product", () => {
    const invalidSpec: EmailSpec = {
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
        button: { radius: 8, style: "solid" },
      },
      sections: [
        {
          id: "header-1",
          type: "header",
          blocks: [],
        },
        {
          id: "product-grid-1",
          type: "productGrid",
          blocks: [
            { type: "productCard", productRef: "non-existent-id" },
            { type: "button", text: "Shop", href: "https://test.com" },
          ],
        },
        {
          id: "footer-1",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}", align: "center" },
          ],
        },
      ],
      catalog: {
        items: [
          {
            id: "product-1",
            title: "Test Product",
            price: "$100",
            image: "https://test.com/product.jpg",
            url: "https://test.com/product",
          },
        ],
      },
    };

    const result = validateEmailSpecStructure({
      spec: invalidSpec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    expect(result.ok).toBe(false);
    const productError = result.issues.find(
      (i) => i.code === "INVALID_PRODUCT_REF"
    );
    expect(productError).toBeDefined();
    expect(productError?.severity).toBe("error");
  });

  it("should fail when section IDs are duplicated", () => {
    const invalidSpec: EmailSpec = {
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
          id: "hero-1", // Duplicate ID
          type: "feature",
          blocks: [],
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

    const result = validateEmailSpecStructure({
      spec: invalidSpec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    expect(result.ok).toBe(false);
    const duplicateError = result.issues.find(
      (i) => i.code === "DUPLICATE_SECTION_IDS"
    );
    expect(duplicateError).toBeDefined();
    expect(duplicateError?.severity).toBe("error");
  });

  it("should fail when twoColumn layout missing columns", () => {
    const invalidSpec: EmailSpec = {
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
        button: { radius: 8, style: "solid" },
      },
      sections: [
        {
          id: "header-1",
          type: "header",
          blocks: [],
        },
        {
          id: "feature-1",
          type: "feature",
          layout: {
            variant: "twoColumn",
            // Missing columns
          },
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

    const result = validateEmailSpecStructure({
      spec: invalidSpec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    expect(result.ok).toBe(false);
    const layoutError = result.issues.find(
      (i) => i.code === "TWO_COLUMN_MISSING_COLUMNS"
    );
    expect(layoutError).toBeDefined();
    expect(layoutError?.severity).toBe("error");
  });

  it("should fail when footer missing unsubscribe token", () => {
    const invalidSpec: EmailSpec = {
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
            {
              type: "smallPrint",
              text: "No unsubscribe here",
              align: "center",
            },
          ],
        },
      ],
    };

    const result = validateEmailSpecStructure({
      spec: invalidSpec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    expect(result.ok).toBe(false);
    const unsubError = result.issues.find(
      (i) => i.code === "FOOTER_MISSING_UNSUBSCRIBE"
    );
    expect(unsubError).toBeDefined();
    expect(unsubError?.severity).toBe("error");
  });

  it("should warn about productCard in unusual section", () => {
    const spec: EmailSpec = {
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
        button: { radius: 8, style: "solid" },
      },
      sections: [
        {
          id: "header-1",
          type: "header",
          blocks: [],
        },
        {
          id: "feature-1",
          type: "feature", // Unusual section for product cards
          blocks: [
            { type: "productCard", productRef: "product-1" },
            { type: "button", text: "Shop", href: "https://test.com" },
          ],
        },
        {
          id: "footer-1",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}", align: "center" },
          ],
        },
      ],
      catalog: {
        items: [
          {
            id: "product-1",
            title: "Test Product",
            price: "$100",
            image: "https://test.com/product.jpg",
            url: "https://test.com/product",
          },
        ],
      },
    };

    const result = validateEmailSpecStructure({
      spec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    expect(result.ok).toBe(true); // Still valid (warning only)
    const warning = result.issues.find(
      (i) => i.code === "PRODUCT_CARD_MISPLACED"
    );
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
  });

  it("should warn about too many sections", () => {
    const spec: EmailSpec = {
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
        button: { radius: 8, style: "solid" },
      },
      sections: [
        { id: "header-1", type: "header", blocks: [] },
        {
          id: "hero-1",
          type: "hero",
          blocks: [{ type: "button", text: "Shop", href: "https://test.com" }],
        },
        { id: "feature-1", type: "feature", blocks: [] },
        { id: "feature-2", type: "feature", blocks: [] },
        { id: "feature-3", type: "feature", blocks: [] },
        { id: "feature-4", type: "feature", blocks: [] },
        { id: "feature-5", type: "feature", blocks: [] },
        {
          id: "footer-1",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}", align: "center" },
          ],
        },
      ],
    };

    const result = validateEmailSpecStructure({
      spec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    expect(result.ok).toBe(true);
    const warning = result.issues.find((i) => i.code === "TOO_MANY_SECTIONS");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
  });
});
