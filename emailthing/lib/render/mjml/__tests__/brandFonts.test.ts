import { describe, it, expect } from "vitest";
import { renderEmailSpecToMjml } from "../renderEmailSpec";
import type { EmailSpec } from "@/lib/schemas/emailSpec";

describe("Brand Font Support", () => {
  const minimalSpec: EmailSpec = {
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
      button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
    },
    sections: [
      {
        id: "header",
        type: "header",
        blocks: [
          {
            type: "heading",
            text: "Test Heading",
          },
        ],
      },
      {
        id: "footer",
        type: "footer",
        blocks: [
          {
            type: "smallPrint",
            text: "Unsubscribe: {{unsubscribe}}",
          },
        ],
      },
    ],
  };

  it("should render string fonts with fallback stack", () => {
    const spec: EmailSpec = {
      ...minimalSpec,
      theme: {
        ...minimalSpec.theme,
        font: {
          heading: "Geograph",
          body: "Inter",
        },
      },
    };

    const { mjml, warnings } = renderEmailSpecToMjml(spec);

    // Check that heading font appears in CSS .heading class
    expect(mjml).toContain(
      ".heading { font-family: Geograph, -apple-system, BlinkMacSystemFont, &#39;Segoe UI&#39;, Roboto, Arial, sans-serif;"
    );

    // Check that body font appears in mj-all
    expect(mjml).toContain(
      '<mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, &#39;Segoe UI&#39;, Roboto, Arial, sans-serif" />'
    );

    // Should warn about missing sourceUrl for custom fonts
    expect(warnings).toHaveLength(2);
    expect(warnings[0].code).toBe("FONT_NO_SOURCE");
    expect(warnings[0].message).toContain("Geograph");
    expect(warnings[1].code).toBe("FONT_NO_SOURCE");
    expect(warnings[1].message).toContain("Inter");
  });

  it("should inject mj-font tags when sourceUrl is provided", () => {
    const spec: EmailSpec = {
      ...minimalSpec,
      theme: {
        ...minimalSpec.theme,
        font: {
          heading: {
            name: "Geograph",
            sourceUrl: "https://fonts.googleapis.com/css2?family=Geograph",
          },
          body: {
            name: "Inter",
            sourceUrl: "https://fonts.googleapis.com/css2?family=Inter",
          },
        },
      },
    };

    const { mjml, warnings } = renderEmailSpecToMjml(spec);

    // Check for mj-font tags
    expect(mjml).toContain('<mj-font name="Geograph" href="https://fonts.googleapis.com/css2?family=Geograph" />');
    expect(mjml).toContain('<mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter" />');

    // Check that heading font appears in CSS .heading class
    expect(mjml).toContain(
      ".heading { font-family: Geograph, -apple-system, BlinkMacSystemFont, &#39;Segoe UI&#39;, Roboto, Arial, sans-serif;"
    );

    // Check that body font appears in mj-all
    expect(mjml).toContain(
      '<mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, &#39;Segoe UI&#39;, Roboto, Arial, sans-serif" />'
    );

    // No warnings when sourceUrl is provided
    expect(warnings).toHaveLength(0);
  });

  it("should apply body font to mj-all and mj-button", () => {
    const spec: EmailSpec = {
      ...minimalSpec,
      theme: {
        ...minimalSpec.theme,
        font: {
          heading: "Geograph",
          body: {
            name: "Inter",
            sourceUrl: "https://fonts.googleapis.com/css2?family=Inter",
          },
        },
      },
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Body font should be in mj-all
    expect(mjml).toContain(
      '<mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, &#39;Segoe UI&#39;, Roboto, Arial, sans-serif" />'
    );

    // Body font should be in mj-button
    expect(mjml).toContain(
      'font-family="Inter, -apple-system, BlinkMacSystemFont, &#39;Segoe UI&#39;, Roboto, Arial, sans-serif"'
    );
  });

  it("should apply heading font to .heading CSS class", () => {
    const spec: EmailSpec = {
      ...minimalSpec,
      theme: {
        ...minimalSpec.theme,
        font: {
          heading: {
            name: "Geograph",
            sourceUrl: "https://fonts.googleapis.com/css2?family=Geograph",
          },
          body: "Inter",
        },
      },
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Heading font should be in .heading class
    expect(mjml).toContain(
      ".heading { font-family: Geograph, -apple-system, BlinkMacSystemFont, &#39;Segoe UI&#39;, Roboto, Arial, sans-serif;"
    );
  });

  it("should not inject duplicate mj-font tags when heading and body use same font", () => {
    const spec: EmailSpec = {
      ...minimalSpec,
      theme: {
        ...minimalSpec.theme,
        font: {
          heading: {
            name: "Inter",
            sourceUrl: "https://fonts.googleapis.com/css2?family=Inter",
          },
          body: {
            name: "Inter",
            sourceUrl: "https://fonts.googleapis.com/css2?family=Inter",
          },
        },
      },
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Should only have one mj-font tag for Inter
    const fontTags = mjml.match(/<mj-font name="Inter"/g);
    expect(fontTags).toHaveLength(1);
  });

  it("should not warn about Arial font without sourceUrl", () => {
    const spec: EmailSpec = {
      ...minimalSpec,
      theme: {
        ...minimalSpec.theme,
        font: {
          heading: "Arial",
          body: "Arial",
        },
      },
    };

    const { warnings } = renderEmailSpecToMjml(spec);

    // Arial is a system font, should not warn
    expect(warnings).toHaveLength(0);
  });

  it("should warn when custom font name provided but no sourceUrl", () => {
    const spec: EmailSpec = {
      ...minimalSpec,
      theme: {
        ...minimalSpec.theme,
        font: {
          heading: {
            name: "Geograph",
            // No sourceUrl
          },
          body: "Inter",
        },
      },
    };

    const { warnings } = renderEmailSpecToMjml(spec);

    // Should warn about both fonts
    expect(warnings).toHaveLength(2);
    expect(warnings.some(w => w.message.includes("Geograph"))).toBe(true);
    expect(warnings.some(w => w.message.includes("Inter"))).toBe(true);
    expect(warnings.every(w => w.code === "FONT_NO_SOURCE")).toBe(true);
  });

  it("should handle mixed string and object font definitions", () => {
    const spec: EmailSpec = {
      ...minimalSpec,
      theme: {
        ...minimalSpec.theme,
        font: {
          heading: {
            name: "Geograph",
            sourceUrl: "https://fonts.googleapis.com/css2?family=Geograph",
          },
          body: "Arial", // String format
        },
      },
    };

    const { mjml, warnings } = renderEmailSpecToMjml(spec);

    // Should inject only Geograph
    expect(mjml).toContain('<mj-font name="Geograph"');
    expect(mjml).not.toContain('<mj-font name="Arial"');

    // Should use Geograph in heading class
    expect(mjml).toContain(".heading { font-family: Geograph,");

    // Should use Arial in body (mj-all)
    expect(mjml).toContain('<mj-all font-family="Arial,');

    // No warnings (Arial is system font)
    expect(warnings).toHaveLength(0);
  });

  it("should properly escape font names in MJML output", () => {
    const spec: EmailSpec = {
      ...minimalSpec,
      theme: {
        ...minimalSpec.theme,
        font: {
          heading: {
            name: "Font & Name",
            sourceUrl: "https://example.com/font.css",
          },
          body: "Arial",
        },
      },
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Should escape ampersand in font name
    expect(mjml).toContain("Font &amp; Name");
  });
});
