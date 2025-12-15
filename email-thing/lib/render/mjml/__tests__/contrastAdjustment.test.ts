/**
 * Tests for automatic contrast adjustment
 * Ensures light backgrounds always have dark text and vice versa
 */

import { describe, it, expect } from "vitest";
import { renderEmailSpecToMjml } from "../renderEmailSpec";
import type { EmailSpec } from "../../../schemas/emailSpec";

describe("Automatic Text Contrast on Backgrounds", () => {
  const baseSpec: EmailSpec = {
    meta: {
      subject: "Contrast Test",
      preheader: "Testing automatic contrast",
    },
    theme: {
      containerWidth: 600,
      backgroundColor: "#FFFFFF",
      surfaceColor: "#F5F5F5", // Light gray
      textColor: "#111111",
      mutedTextColor: "#666666",
      primaryColor: "#0066CC",
      font: {
        heading: "Arial",
        body: "Arial",
      },
      button: {
        radius: 8,
        style: "solid" as const,
        paddingY: 12,
        paddingX: 24,
      },
    },
    sections: [
      {
        id: "header",
        type: "header",
        blocks: [
          {
            type: "heading",
            text: "Header Title",
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
            text: "Footer content",
          },
        ],
      },
    ],
  };

  it("should use dark text on light gray surface background", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "content",
          type: "hero",
          style: {
            background: "surface", // Light gray #F5F5F5
          },
          blocks: [
            {
              type: "heading",
              text: "Buy One, Get One Free!",
              level: 1,
            },
            {
              type: "paragraph",
              text: "This text should be dark on light background",
            },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Check that heading has dark color (not white)
    // The text should have color="#000000" or similar dark color
    expect(mjml).toContain('Buy One, Get One Free!');
    
    // Should NOT have white text (color="#FFFFFF" or color="#FFF")
    const whiteTextPattern = /<mj-text[^>]*color="#FFFFFF"[^>]*>Buy One, Get One Free!</i;
    expect(mjml).not.toMatch(whiteTextPattern);
    
    // Should have dark text (black or very dark gray)
    const darkTextPattern = /<mj-text[^>]*color="(#000000|#111111|#000|#222222)"[^>]*>Buy One, Get One Free!</i;
    expect(mjml).toMatch(darkTextPattern);
  });

  it("should use light text on dark background", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      theme: {
        ...baseSpec.theme,
        primaryColor: "#111111", // Dark color
      },
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "content",
          type: "hero",
          style: {
            background: "brand", // Dark primary color
          },
          blocks: [
            {
              type: "heading",
              text: "Dark Background Section",
              level: 1,
            },
            {
              type: "paragraph",
              text: "This text should be light on dark background",
            },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Check that text has light color (white or very light)
    expect(mjml).toContain('Dark Background Section');
    
    // Should have light text (white or light gray)
    const lightTextPattern = /<mj-text[^>]*color="(#FFFFFF|#FFF|#EEEEEE|#F5F5F5)"[^>]*>Dark Background Section</i;
    expect(mjml).toMatch(lightTextPattern);
  });

  it("should use dark text on white background", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "content",
          type: "hero",
          style: {
            background: "transparent", // White/transparent
          },
          blocks: [
            {
              type: "heading",
              text: "White Background Text",
              level: 1,
            },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Should have dark text on white background
    const darkTextPattern = /<mj-text[^>]*color="(#000000|#111111|#000|#222222)"[^>]*>White Background Text</i;
    expect(mjml).toMatch(darkTextPattern);
  });

  it("should handle multiple sections with different backgrounds", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "light-section",
          type: "hero",
          style: {
            background: "surface", // Light
          },
          blocks: [
            {
              type: "heading",
              text: "Light Section",
              level: 2,
            },
          ],
        },
        {
          id: "dark-section",
          type: "feature",
          style: {
            background: "brand", // Dark
          },
          blocks: [
            {
              type: "heading",
              text: "Dark Section",
              level: 2,
            },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Light section should have dark text
    const lightSectionIndex = mjml.indexOf('Light Section');
    const darkSectionIndex = mjml.indexOf('Dark Section');

    expect(lightSectionIndex).toBeGreaterThan(-1);
    expect(darkSectionIndex).toBeGreaterThan(-1);

    // Check each section independently
    const beforeDarkSection = mjml.substring(0, darkSectionIndex);
    const darkTextInLightSection = /<mj-text[^>]*color="(#000000|#111111|#000|#222222)"[^>]*>Light Section</i;
    expect(beforeDarkSection).toMatch(darkTextInLightSection);
  });

  it("should use dark text on very light custom background", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      theme: {
        ...baseSpec.theme,
        surfaceColor: "#FAFAFA", // Very light gray
      },
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "content",
          type: "hero",
          style: {
            background: "surface",
          },
          blocks: [
            {
              type: "heading",
              text: "Very Light Background",
              level: 1,
            },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Should use dark text on very light background
    const darkTextPattern = /<mj-text[^>]*color="(#000000|#111111|#000|#222222)"[^>]*>Very Light Background</i;
    expect(mjml).toMatch(darkTextPattern);
  });

  it("should use light text on medium gray background", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      theme: {
        ...baseSpec.theme,
        surfaceColor: "#666666", // Medium gray (luminance ~0.22, below 0.5)
      },
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "content",
          type: "hero",
          style: {
            background: "surface",
          },
          blocks: [
            {
              type: "heading",
              text: "Medium Gray Background",
              level: 1,
            },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Should use light text on medium-dark background
    const lightTextPattern = /<mj-text[^>]*color="(#FFFFFF|#FFF|#EEEEEE|#F5F5F5)"[^>]*>Medium Gray Background</i;
    expect(mjml).toMatch(lightTextPattern);
  });

  it("should handle edge case: exactly 50% luminance", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      theme: {
        ...baseSpec.theme,
        surfaceColor: "#808080", // Exactly 50% gray (luminance ~0.22)
      },
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "content",
          type: "hero",
          style: {
            background: "surface",
          },
          blocks: [
            {
              type: "heading",
              text: "50% Gray Background",
              level: 1,
            },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Should have either dark or light text (system chooses based on luminance formula)
    expect(mjml).toContain('50% Gray Background');
    
    // Just verify it has some color (not missing)
    const hasColorPattern = /<mj-text[^>]*color="#[0-9A-F]{6}"[^>]*>50% Gray Background</i;
    expect(mjml).toMatch(hasColorPattern);
  });

  it("should work with paragraph blocks as well as headings", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "content",
          type: "hero",
          style: {
            background: "surface", // Light gray
          },
          blocks: [
            {
              type: "paragraph",
              text: "This is a paragraph on light background",
            },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Paragraph should also have dark text on light background
    const darkTextPattern = /<mj-text[^>]*color="(#000000|#111111|#000|#222222)"[^>]*>This is a paragraph on light background</i;
    expect(mjml).toMatch(darkTextPattern);
  });

  it("should work with small print blocks in footer", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      theme: {
        ...baseSpec.theme,
        backgroundColor: "#F0F0F0", // Light background for entire email
      },
      sections: [
        baseSpec.sections[0],
        {
          id: "footer",
          type: "footer",
          style: {
            background: "transparent", // Inherits light background
          },
          blocks: [
            {
              type: "smallPrint",
              text: "Footer small print text",
            },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Small print should have dark text on light background
    expect(mjml).toContain('Footer small print text');
    
    // Should have dark or muted color (not white)
    const notWhitePattern = /color="#FFFFFF"[^>]*>Footer small print text</i;
    expect(mjml).not.toMatch(notWhitePattern);
  });
});
