import { describe, it, expect } from "vitest";
import { renderEmailSpecToMjml } from "../renderEmailSpec";
import type { EmailSpec } from "../../../schemas/emailSpec";

describe("Enhanced EmailSpec Rendering", () => {
  it("should render new block types without errors", () => {
    const spec: EmailSpec = {
      meta: {
        subject: "Test Email",
        preheader: "Test preheader text",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#2563EB",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid", paddingY: 12, paddingX: 24 },
        palette: {
          primary: "#2563EB",
          ink: "#111111",
          bg: "#FFFFFF",
          surface: "#F5F5F5",
          muted: "#9CA3AF",
          accent: "#7C3AED",
          primarySoft: "#DBEAFE",
          accentSoft: "#EDE9FE",
        },
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
          id: "content",
          type: "hero",
          blocks: [
            {
              type: "badge",
              text: "NEW",
              tone: "primary",
            },
            {
              type: "bullets",
              items: ["Item 1", "Item 2", "Item 3"],
              icon: "✓",
            },
            {
              type: "priceLine",
              price: "$99",
              compareAt: "$149",
              savingsText: "Save $50",
            },
            {
              type: "rating",
              value: 4.5,
              count: 127,
            },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            {
              type: "navLinks",
              links: [
                { label: "About", url: "https://example.com/about" },
                { label: "Contact", url: "https://example.com/contact" },
              ],
            },
            {
              type: "socialIcons",
              links: [
                { network: "facebook", url: "https://facebook.com/example" },
                { network: "twitter", url: "https://twitter.com/example" },
              ],
            },
            {
              type: "smallPrint",
              text: "Unsubscribe: {{unsubscribe}}",
            },
          ],
        },
      ],
    };

    const result = renderEmailSpecToMjml(spec);

    expect(result.mjml).toBeTruthy();
    expect(result.mjml).toContain("<mjml>");
    expect(result.mjml).toContain("</mjml>");
    expect(result.mjml).toContain("Test Email");

    // Check for new block types in output
    expect(result.mjml).toContain("NEW"); // badge
    expect(result.mjml).toContain("Item 1"); // bullets
    expect(result.mjml).toContain("$99"); // priceLine
    expect(result.mjml).toContain("★"); // rating stars

    expect(result.warnings).toBeDefined();
  });

  it("should render sections with background tokens", () => {
    const spec: EmailSpec = {
      meta: {
        subject: "Test Email",
        preheader: "Test preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#2563EB",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid", paddingY: 12, paddingX: 24 },
        palette: {
          primary: "#2563EB",
          ink: "#111111",
          bg: "#FFFFFF",
          surface: "#F5F5F5",
          muted: "#9CA3AF",
          accent: "#7C3AED",
          primarySoft: "#DBEAFE",
          accentSoft: "#EDE9FE",
        },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [{ type: "logo", src: "https://example.com/logo.png" }],
        },
        {
          id: "hero",
          type: "hero",
          style: {
            background: "primarySoft",
          },
          blocks: [
            {
              type: "heading",
              text: "Welcome",
              level: 1,
            },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            {
              type: "smallPrint",
              text: "Footer {{unsubscribe}}",
            },
          ],
        },
      ],
    };

    const result = renderEmailSpecToMjml(spec);

    expect(result.mjml).toBeTruthy();
    // Should resolve primarySoft token to #DBEAFE
    expect(result.mjml).toContain("#DBEAFE");
  });

  it("should handle backward compatibility with legacy specs", () => {
    const legacySpec: EmailSpec = {
      meta: {
        subject: "Legacy Email",
        preheader: "Legacy preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#2563EB",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid", paddingY: 12, paddingX: 24 },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [{ type: "logo", src: "https://example.com/logo.png" }],
        },
        {
          id: "content",
          type: "hero",
          blocks: [
            {
              type: "heading",
              text: "Hello",
              level: 1,
            },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            {
              type: "smallPrint",
              text: "Unsubscribe {{unsubscribe}}",
            },
          ],
        },
      ],
    };

    const result = renderEmailSpecToMjml(legacySpec);

    expect(result.mjml).toBeTruthy();
    expect(result.mjml).toContain("<mjml>");
    expect(result.mjml).toContain("Legacy Email");
    expect(result.warnings).toBeDefined();
  });
});
