import { describe, it, expect } from "vitest";
import { load } from "cheerio";
import { extractLogoUrl } from "../extract/logo";

describe("extractLogoUrl", () => {
  it("should extract logo with class containing 'logo'", () => {
    const html = `
      <html>
        <body>
          <header>
            <img src="/logo.png" class="site-logo" alt="Brand Logo">
          </header>
        </body>
      </html>
    `;
    const $ = load(html);
    const baseUrl = new URL("https://example.com");
    const logoUrl = extractLogoUrl($, baseUrl, "Brand");
    expect(logoUrl).toBe("https://example.com/logo.png");
  });

  it("should extract logo with id containing 'logo'", () => {
    const html = `
      <html>
        <body>
          <img src="/brand-logo.svg" id="main-logo" alt="Logo">
        </body>
      </html>
    `;
    const $ = load(html);
    const baseUrl = new URL("https://example.com");
    const logoUrl = extractLogoUrl($, baseUrl, "Brand");
    expect(logoUrl).toBe("https://example.com/brand-logo.svg");
  });

  it("should fallback to favicon when no logo found", () => {
    const html = `
      <html>
        <head>
          <link rel="icon" href="/favicon.ico">
        </head>
        <body>
          <img src="/random-image.jpg" alt="Random">
        </body>
      </html>
    `;
    const $ = load(html);
    const baseUrl = new URL("https://example.com");
    const logoUrl = extractLogoUrl($, baseUrl, "Brand");
    expect(logoUrl).toBe("https://example.com/favicon.ico");
  });

  it("should prefer images in header", () => {
    const html = `
      <html>
        <body>
          <img src="/logo-footer.png" class="logo" alt="Footer Logo">
          <header>
            <img src="/logo-header.png" class="logo" alt="Header Logo">
          </header>
        </body>
      </html>
    `;
    const $ = load(html);
    const baseUrl = new URL("https://example.com");
    const logoUrl = extractLogoUrl($, baseUrl, "Brand");
    expect(logoUrl).toBe("https://example.com/logo-header.png");
  });
});
