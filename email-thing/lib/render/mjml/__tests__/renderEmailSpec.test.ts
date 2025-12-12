import { describe, it, expect } from "vitest";
import {
  renderEmailSpecToMjml,
  compileMjmlToHtml,
} from "../renderEmailSpec";
import type { EmailSpec } from "@/lib/schemas/emailSpec";

describe("renderEmailSpecToMjml", () => {
  it("should render minimal valid spec to MJML and HTML", async () => {
    const minimalSpec: EmailSpec = {
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
        button: { radius: 8, style: "solid" as const },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [
            {
              type: "logo",
              src: "https://example.com/logo.png",
            },
          ],
        },
        {
          id: "hero",
          type: "hero",
          blocks: [
            {
              type: "heading",
              text: "Welcome",
            },
            {
              type: "button",
              text: "Click me",
              href: "https://example.com",
            },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            {
              type: "smallPrint",
              text: "Unsubscribe",
            },
          ],
        },
      ],
    };

    const { mjml, warnings } = renderEmailSpecToMjml(minimalSpec);

    expect(mjml).toContain("<mjml>");
    expect(mjml).toContain("</mjml>");
    expect(mjml).toContain("Test Subject");
    expect(mjml).toContain("Test preheader text");
    expect(mjml).toContain("Welcome");
    expect(mjml).toContain("Click me");
    expect(warnings).toEqual([]);

    // Compile to HTML
    const { html, errors } = await compileMjmlToHtml(mjml);
    expect(html).toBeTruthy();
    expect(html).toContain("Welcome");
    expect(errors).toEqual([]);
  });

  it("should handle twoColumn layout with missing widths and emit warning", () => {
    const spec: EmailSpec = {
      meta: {
        subject: "Test",
        preheader: "Test preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" as const },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [{ type: "heading", text: "Header" }],
        },
        {
          id: "feature",
          type: "feature",
          layout: {
            variant: "twoColumn",
          },
          blocks: [
            { type: "heading", text: "Left" },
            { type: "heading", text: "Right" },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            { type: "button", text: "CTA", href: "https://example.com" },
          ],
        },
      ],
    };

    const { mjml, warnings } = renderEmailSpecToMjml(spec);

    expect(mjml).toContain("50%");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("MISSING_COLUMN_SPEC");
    expect(warnings[0].message).toContain("50/50 default");
  });

  it("should handle empty/invalid button href and emit warning", () => {
    const spec: EmailSpec = {
      meta: {
        subject: "Test",
        preheader: "Test preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" as const },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [{ type: "heading", text: "Header" }],
        },
        {
          id: "hero",
          type: "hero",
          blocks: [
            {
              type: "button",
              text: "Invalid Button",
              href: "not-a-valid-url",
            },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            { type: "button", text: "Valid", href: "https://example.com" },
          ],
        },
      ],
    };

    const { mjml, warnings } = renderEmailSpecToMjml(spec);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("INVALID_BUTTON_HREF");
    expect(mjml).toContain("Invalid Button");
    // Should render as text instead of button
    expect(mjml).toContain("<mj-text");
  });

  it("should handle catalog empty with productCard and emit warning", () => {
    const spec: EmailSpec = {
      meta: {
        subject: "Test",
        preheader: "Test preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" as const },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [{ type: "heading", text: "Header" }],
        },
        {
          id: "products",
          type: "productGrid",
          blocks: [
            {
              type: "productCard",
              productRef: "product-123",
            },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            { type: "button", text: "CTA", href: "https://example.com" },
          ],
        },
      ],
      catalog: {
        items: [],
      },
    };

    const { mjml, warnings } = renderEmailSpecToMjml(spec);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("PRODUCT_NOT_FOUND");
    expect(warnings[0].message).toContain("product-123");
    expect(mjml).toContain("Product unavailable");
  });

  it("should apply theme tokens correctly", () => {
    const spec: EmailSpec = {
      meta: {
        subject: "Test",
        preheader: "Test preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FF0000",
        surfaceColor: "#00FF00",
        textColor: "#0000FF",
        mutedTextColor: "#CCCCCC",
        primaryColor: "#FF00FF",
        font: { heading: "Helvetica", body: "Georgia" },
        button: { radius: 16, style: "outline" as const },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [{ type: "heading", text: "Header" }],
        },
        {
          id: "hero",
          type: "hero",
          blocks: [
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [{ type: "smallPrint", text: "Footer" }],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    expect(mjml).toContain("#FF0000"); // backgroundColor
    expect(mjml).toContain("#0000FF"); // textColor
    expect(mjml).toContain("#FF00FF"); // primaryColor
    expect(mjml).toContain("Helvetica"); // heading font
    expect(mjml).toContain("Georgia"); // body font
    expect(mjml).toContain("16px"); // button radius
  });

  it("should handle grid layout with missing gap and emit warning", () => {
    const spec: EmailSpec = {
      meta: {
        subject: "Test",
        preheader: "Test preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" as const },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [{ type: "heading", text: "Header" }],
        },
        {
          id: "grid",
          type: "productGrid",
          layout: {
            variant: "grid",
            columns: 3,
            gap: 0,
          },
          blocks: [
            { type: "heading", text: "Item 1" },
            { type: "heading", text: "Item 2" },
            { type: "heading", text: "Item 3" },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            { type: "button", text: "CTA", href: "https://example.com" },
          ],
        },
      ],
    };

    const { mjml, warnings } = renderEmailSpecToMjml(spec);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("MISSING_GRID_GAP");
    expect(warnings[0].message).toContain("12px default");
    expect(mjml).toBeTruthy();
  });

  it("should render product card with valid catalog reference", () => {
    const spec: EmailSpec = {
      meta: {
        subject: "Test",
        preheader: "Test preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" as const },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [{ type: "heading", text: "Header" }],
        },
        {
          id: "products",
          type: "productGrid",
          blocks: [
            {
              type: "productCard",
              productRef: "prod-1",
            },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            { type: "button", text: "CTA", href: "https://example.com" },
          ],
        },
      ],
      catalog: {
        items: [
          {
            id: "prod-1",
            title: "Test Product",
            price: "$99",
            image: "https://example.com/product.jpg",
            url: "https://example.com/product",
          },
        ],
      },
    };

    const { mjml, warnings } = renderEmailSpecToMjml(spec);

    expect(warnings).toHaveLength(0);
    expect(mjml).toContain("Test Product");
    expect(mjml).toContain("$99");
    expect(mjml).toContain("https://example.com/product.jpg");
  });
});
