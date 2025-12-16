import { describe, it, expect } from "vitest";
import { EmailSpecSchema } from "../emailSpec";
import emailSpecSaleExample from "../../../spec/examples/emailSpec.sale.example.json";
import emailSpecLaunchExample from "../../../spec/examples/emailSpec.launch.example.json";

describe("EmailSpec Schema", () => {
  it("validates the sale example fixture", () => {
    const result = EmailSpecSchema.safeParse(emailSpecSaleExample);
    expect(result.success).toBe(true);
  });

  it("validates the launch example fixture", () => {
    const result = EmailSpecSchema.safeParse(emailSpecLaunchExample);
    expect(result.success).toBe(true);
  });

  it("applies theme defaults", () => {
    const minimal = {
      meta: {
        subject: "Test Subject Line",
        preheader: "Test preheader text here",
      },
      sections: [
        {
          id: "test-1",
          type: "header",
          blocks: [],
        },
        {
          id: "test-2",
          type: "hero",
          blocks: [
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        {
          id: "test-3",
          type: "footer",
          blocks: [],
        },
      ],
    };

    const result = EmailSpecSchema.parse(minimal);

    expect(result.theme.containerWidth).toBe(600);
    expect(result.theme.backgroundColor).toBe("#FFFFFF");
    expect(result.theme.primaryColor).toBe("#111111");
    expect(result.theme.button.radius).toBe(8);
    expect(result.theme.button.style).toBe("solid");
  });

  it("clamps containerWidth to valid range", () => {
    const tooSmall = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        containerWidth: 400, // Too small (min 480)
      },
      sections: [{ id: "1", type: "header", blocks: [] }],
    };

    const result = EmailSpecSchema.safeParse(tooSmall);
    expect(result.success).toBe(false);
  });

  it("validates subject length constraints", () => {
    const tooShort = {
      meta: {
        subject: "Hi",
        preheader: "Valid preheader text",
      },
      sections: [{ id: "1", type: "header", blocks: [] }],
    };

    const result = EmailSpecSchema.safeParse(tooShort);
    expect(result.success).toBe(false);
  });

  it("validates button radius range", () => {
    const validRadius = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        button: {
          radius: 12,
          style: "solid",
        },
      },
      sections: [
        { id: "1", type: "header", blocks: [] },
        {
          id: "2",
          type: "hero",
          blocks: [
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        { id: "3", type: "footer", blocks: [] },
      ],
    };

    const result = EmailSpecSchema.safeParse(validRadius);
    expect(result.success).toBe(true);
  });

  it("rejects button radius outside range", () => {
    const invalidRadius = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        button: {
          radius: 30, // Max 24
          style: "solid",
        },
      },
      sections: [{ id: "1", type: "header", blocks: [] }],
    };

    const result = EmailSpecSchema.safeParse(invalidRadius);
    expect(result.success).toBe(false);
  });

  it("validates section padding constraints", () => {
    const validPadding = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        {
          id: "1",
          type: "header",
          blocks: [],
          style: {
            paddingX: 32,
            paddingY: 24,
          },
        },
        {
          id: "2",
          type: "hero",
          blocks: [
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        {
          id: "3",
          type: "footer",
          blocks: [],
        },
      ],
    };

    const result = EmailSpecSchema.safeParse(validPadding);
    expect(result.success).toBe(true);
  });

  it("requires at least one section", () => {
    const noSections = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [],
    };

    const result = EmailSpecSchema.safeParse(noSections);
    expect(result.success).toBe(false);
  });

  it("validates hex colors in theme", () => {
    const validColors = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        backgroundColor: "#FFFFFF",
        textColor: "#000000",
        primaryColor: "#FF6B35",
      },
      sections: [
        { id: "1", type: "header", blocks: [] },
        {
          id: "2",
          type: "hero",
          blocks: [
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        { id: "3", type: "footer", blocks: [] },
      ],
    };

    const result = EmailSpecSchema.safeParse(validColors);
    expect(result.success).toBe(true);
  });

  it("requires header section", () => {
    const noHeader = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        {
          id: "1",
          type: "hero",
          blocks: [
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        { id: "2", type: "footer", blocks: [] },
        { id: "3", type: "feature", blocks: [] },
      ],
    };

    const result = EmailSpecSchema.safeParse(noHeader);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMessages = result.error.issues.map((e) => e.message);
      expect(errorMessages).toContain(
        "Must include at least one 'header' section"
      );
    }
  });

  it("requires footer section", () => {
    const noFooter = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        { id: "1", type: "header", blocks: [] },
        {
          id: "2",
          type: "hero",
          blocks: [
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        { id: "3", type: "feature", blocks: [] },
      ],
    };

    const result = EmailSpecSchema.safeParse(noFooter);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMessages = result.error.issues.map((e) => e.message);
      expect(errorMessages).toContain(
        "Must include at least one 'footer' section"
      );
    }
  });

  it("requires at least one button block for CTA", () => {
    const noButton = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        {
          id: "1",
          type: "header",
          blocks: [{ type: "logo", src: "logo.png" }],
        },
        {
          id: "2",
          type: "hero",
          blocks: [{ type: "heading", text: "Hello", level: 1 }],
        },
        { id: "3", type: "footer", blocks: [] },
      ],
    };

    const result = EmailSpecSchema.safeParse(noButton);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMessages = result.error.issues.map((e) => e.message);
      expect(errorMessages).toContain(
        "Must include at least one 'button' block for CTA"
      );
    }
  });

  it("validates productCard references existing catalog items", () => {
    const invalidProductRef = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        { id: "1", type: "header", blocks: [] },
        {
          id: "2",
          type: "productGrid",
          blocks: [
            { type: "productCard", productRef: "nonexistent-product" },
            { type: "button", text: "Shop", href: "https://example.com" },
          ],
        },
        { id: "3", type: "footer", blocks: [] },
      ],
      catalog: {
        items: [
          {
            id: "product-1",
            title: "Product 1",
            price: "$10",
            image: "https://example.com/p1.jpg",
            url: "https://example.com/p1",
          },
        ],
      },
    };

    const result = EmailSpecSchema.safeParse(invalidProductRef);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorMessages = result.error.issues.map((e) => e.message);
      expect(errorMessages).toContain(
        'Product reference "nonexistent-product" not found in catalog'
      );
    }
  });

  it("rejects productCard blocks when catalog is empty", () => {
    const productCardWithoutCatalog = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        { id: "1", type: "header", blocks: [] },
        {
          id: "2",
          type: "hero",
          blocks: [
            { type: "productCard", productRef: "product-1" },
            { type: "button", text: "Shop", href: "https://example.com" },
          ],
        },
        { id: "3", type: "footer", blocks: [] },
      ],
    };

    const result = EmailSpecSchema.safeParse(productCardWithoutCatalog);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.format();
      expect(errors.sections?.[1]?.blocks?.[0]?._errors).toContain(
        "Cannot have productCard blocks when catalog is empty"
      );
    }
  });

  it("validates text blocks do not contain HTML", () => {
    const withHtml = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        { id: "1", type: "header", blocks: [] },
        {
          id: "2",
          type: "hero",
          blocks: [
            { type: "heading", text: "Hello <b>World</b>", level: 1 },
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        { id: "3", type: "footer", blocks: [] },
      ],
    };

    const result = EmailSpecSchema.safeParse(withHtml);
    // The block schema should sanitize HTML by stripping < and >
    if (result.success) {
      expect(result.data.sections[1].blocks[0]).toMatchObject({
        type: "heading",
        text: "Hello bWorld/b", // HTML tags stripped
      });
    }
  });

  it("validates minimum 3 sections", () => {
    const tooFewSections = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        {
          id: "1",
          type: "header",
          blocks: [
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        { id: "2", type: "footer", blocks: [] },
      ],
    };

    const result = EmailSpecSchema.safeParse(tooFewSections);
    expect(result.success).toBe(false);
  });

  it("validates maximum 10 sections", () => {
    const tooManySections = {
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      sections: [
        {
          id: "1",
          type: "header",
          blocks: [
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        { id: "2", type: "hero", blocks: [] },
        { id: "3", type: "feature", blocks: [] },
        { id: "4", type: "feature", blocks: [] },
        { id: "5", type: "feature", blocks: [] },
        { id: "6", type: "feature", blocks: [] },
        { id: "7", type: "feature", blocks: [] },
        { id: "8", type: "feature", blocks: [] },
        { id: "9", type: "feature", blocks: [] },
        { id: "10", type: "feature", blocks: [] },
        { id: "11", type: "footer", blocks: [] },
      ],
    };

    const result = EmailSpecSchema.safeParse(tooManySections);
    expect(result.success).toBe(false);
  });
});
