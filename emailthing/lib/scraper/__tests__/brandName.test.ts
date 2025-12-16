import { describe, it, expect } from "vitest";
import { load } from "cheerio";
import { extractBrandName } from "../extract/brandName";

describe("extractBrandName", () => {
  it("should extract from og:site_name", () => {
    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="MyBrand">
          <title>Welcome to MyBrand Store</title>
        </head>
      </html>
    `;
    const $ = load(html);
    const name = extractBrandName($, "example.com");
    expect(name).toBe("MyBrand");
  });

  it("should extract from title tag when og:site_name missing", () => {
    const html = `
      <html>
        <head>
          <title>CoolStore - Home</title>
        </head>
      </html>
    `;
    const $ = load(html);
    const name = extractBrandName($, "example.com");
    expect(name).toBe("CoolStore");
  });

  it("should fallback to hostname when no metadata", () => {
    const html = `
      <html>
        <head></head>
      </html>
    `;
    const $ = load(html);
    const name = extractBrandName($, "example.com");
    expect(name).toBe("Example");
  });

  it("should clean title with common suffixes", () => {
    const html = `
      <html>
        <head>
          <title>AwesomeBrand | Official Store</title>
        </head>
      </html>
    `;
    const $ = load(html);
    const name = extractBrandName($, "example.com");
    expect(name).toBe("AwesomeBrand");
  });
});
