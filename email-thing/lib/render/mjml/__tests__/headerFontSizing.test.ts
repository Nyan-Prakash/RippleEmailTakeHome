import { describe, it, expect } from "vitest";
import { renderEmailSpecToMjml } from "../renderEmailSpec";
import type { EmailSpec } from "../../../schemas/emailSpec";

describe("Header Font Sizing Enhancement", () => {
  it("should render header sections with 48px font size for h1", () => {
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
        button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [
            { type: "heading", text: "Header Title", level: 1 },
          ],
        },
        {
          id: "hero",
          type: "hero",
          blocks: [
            { type: "heading", text: "Hero Title", level: 1 },
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}" },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Header section should have 48px font size
    expect(mjml).toContain('font-size="48px"');
    
    // Hero section should have 32px font size (regular)
    expect(mjml).toContain('font-size="32px"');
    
    // Header should have font-weight 700
    expect(mjml).toContain('font-weight="700"');
    
    // Regular section should have font-weight 600
    expect(mjml).toContain('font-weight="600"');
  });

  it("should render navHeader sections with larger fonts", () => {
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
        button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
      },
      sections: [
        {
          id: "nav-header",
          type: "navHeader",
          blocks: [
            { type: "heading", text: "Brand Name", level: 1 },
          ],
        },
        {
          id: "content",
          type: "feature",
          blocks: [
            { type: "heading", text: "Feature Title", level: 1 },
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}" },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // navHeader section should have 48px font size
    expect(mjml).toContain('font-size="48px"');
    
    // Feature section should have 32px font size
    expect(mjml).toContain('font-size="32px"');
  });

  it("should render announcementBar sections with larger fonts", () => {
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
        button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
      },
      sections: [
        {
          id: "announcement",
          type: "announcementBar",
          blocks: [
            { type: "heading", text: "Flash Sale!", level: 2 },
          ],
        },
        {
          id: "hero",
          type: "hero",
          blocks: [
            { type: "heading", text: "Shop Now", level: 2 },
            { type: "button", text: "Click", href: "https://example.com" },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}" },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // announcementBar section should have 36px font size for h2
    expect(mjml).toContain('font-size="36px"');
    
    // Hero section should have 28px font size for h2
    expect(mjml).toContain('font-size="28px"');
  });

  it("should apply different font sizes for different heading levels in headers", () => {
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
        button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [
            { type: "heading", text: "Main Title", level: 1 },
            { type: "heading", text: "Subtitle", level: 2 },
            { type: "heading", text: "Tagline", level: 3 },
          ],
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
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}" },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Header h1: 48px
    expect(mjml).toContain('font-size="48px"');
    
    // Header h2: 36px
    expect(mjml).toContain('font-size="36px"');
    
    // Header h3: 30px
    expect(mjml).toContain('font-size="30px"');
  });

  it("should maintain consistent font sizing across non-header sections", () => {
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
        button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
      },
      sections: [
        {
          id: "header",
          type: "header",
          blocks: [
            { type: "logo", src: "https://example.com/logo.png" },
          ],
        },
        {
          id: "hero",
          type: "hero",
          blocks: [
            { type: "heading", text: "Hero Title", level: 1 },
          ],
        },
        {
          id: "feature",
          type: "feature",
          blocks: [
            { type: "heading", text: "Feature Title", level: 1 },
          ],
        },
        {
          id: "footer",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}" },
          ],
        },
      ],
    };

    const { mjml } = renderEmailSpecToMjml(spec);

    // Both hero and feature should use 32px (no 48px since header has no heading)
    const fontSizeMatches = mjml.match(/font-size="32px"/g);
    expect(fontSizeMatches).toBeTruthy();
    expect(fontSizeMatches!.length).toBeGreaterThanOrEqual(2);
    
    // Should not have 48px since header has no heading block
    expect(mjml).not.toContain('font-size="48px"');
  });
});
