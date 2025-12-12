import { describe, it, expect } from "vitest";
import { validateEmailSpecStructure } from "../emailSpec";
import type { EmailSpec } from "../../schemas/emailSpec";

describe("validateEmailSpecStructure", () => {
  const createMinimalSpec = (): EmailSpec => ({
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
    sections: [],
  });

  it("catches missing CTA button", () => {
    const spec = createMinimalSpec();
    spec.sections = [
      {
        id: "header-1",
        type: "header",
        blocks: [{ type: "logo", src: "logo.png" }],
      },
      {
        id: "footer-1",
        type: "footer",
        blocks: [
          {
            type: "smallPrint",
            text: "Unsubscribe here: {{unsubscribe}}",
          },
        ],
      },
    ];

    const result = validateEmailSpecStructure(spec);

    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain("CTA button");
  });

  it("catches missing footer section", () => {
    const spec = createMinimalSpec();
    spec.sections = [
      {
        id: "header-1",
        type: "header",
        blocks: [
          { type: "button", text: "Click", href: "https://example.com" },
        ],
      },
    ];

    const result = validateEmailSpecStructure(spec);

    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("footer"))).toBe(true);
  });

  it("catches missing unsubscribe token in footer", () => {
    const spec = createMinimalSpec();
    spec.sections = [
      {
        id: "hero-1",
        type: "hero",
        blocks: [{ type: "button", text: "Shop", href: "https://example.com" }],
      },
      {
        id: "footer-1",
        type: "footer",
        blocks: [
          {
            type: "smallPrint",
            text: "This is footer text without the token",
          },
        ],
      },
    ];

    const result = validateEmailSpecStructure(spec);

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.message.includes("{{unsubscribe}}"))
    ).toBe(true);
  });

  it("validates correct spec with all requirements", () => {
    const spec = createMinimalSpec();
    spec.sections = [
      {
        id: "hero-1",
        type: "hero",
        blocks: [
          { type: "heading", text: "Welcome", level: 1 },
          { type: "button", text: "Shop Now", href: "https://example.com" },
        ],
      },
      {
        id: "footer-1",
        type: "footer",
        blocks: [
          {
            type: "smallPrint",
            text: "Click to {{unsubscribe}} from our emails",
          },
        ],
      },
    ];

    const result = validateEmailSpecStructure(spec);

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("catches duplicate section IDs", () => {
    const spec = createMinimalSpec();
    spec.sections = [
      {
        id: "section-1",
        type: "hero",
        blocks: [
          { type: "button", text: "Click", href: "https://example.com" },
        ],
      },
      {
        id: "section-1", // Duplicate!
        type: "footer",
        blocks: [
          {
            type: "smallPrint",
            text: "{{unsubscribe}}",
          },
        ],
      },
    ];

    const result = validateEmailSpecStructure(spec);

    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Duplicate"))).toBe(
      true
    );
  });

  it("validates product references exist in catalog", () => {
    const spec = createMinimalSpec();
    spec.catalog = {
      items: [
        {
          id: "prod-1",
          title: "Product 1",
          price: "$10",
          image: "img.jpg",
          url: "https://example.com/prod-1",
        },
      ],
    };
    spec.sections = [
      {
        id: "products-1",
        type: "productGrid",
        blocks: [
          { type: "productCard", productRef: "prod-1" }, // Valid
          { type: "productCard", productRef: "prod-999" }, // Invalid
          { type: "button", text: "Shop", href: "https://example.com" },
        ],
      },
      {
        id: "footer-1",
        type: "footer",
        blocks: [{ type: "smallPrint", text: "{{unsubscribe}}" }],
      },
    ];

    const result = validateEmailSpecStructure(spec);

    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("prod-999"))).toBe(
      true
    );
  });

  it("finds CTA in two-column layout", () => {
    const spec = createMinimalSpec();
    spec.sections = [
      {
        id: "feature-1",
        type: "feature",
        layout: {
          variant: "twoColumn",
          columns: [
            {
              width: "50%",
              blocks: [{ type: "heading", text: "Feature" }],
            },
            {
              width: "50%",
              blocks: [
                {
                  type: "button",
                  text: "Learn More",
                  href: "https://example.com",
                },
              ],
            },
          ],
        },
        blocks: [],
      },
      {
        id: "footer-1",
        type: "footer",
        blocks: [{ type: "smallPrint", text: "{{unsubscribe}}" }],
      },
    ];

    const result = validateEmailSpecStructure(spec);

    expect(result.ok).toBe(true);
  });
});
