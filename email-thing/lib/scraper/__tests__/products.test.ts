import { describe, it, expect } from "vitest";
import { load } from "cheerio";
import { extractProductsFromJsonLd } from "../extract/products";

describe("extractProductsFromJsonLd", () => {
  it("should extract product from JSON-LD", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Test Product",
            "image": "/images/product.jpg",
            "url": "/products/test",
            "offers": {
              "@type": "Offer",
              "price": "99.99",
              "priceCurrency": "USD"
            }
          }
          </script>
        </head>
      </html>
    `;
    const $ = load(html);
    const baseUrl = new URL("https://example.com");
    const products = extractProductsFromJsonLd($, baseUrl);

    expect(products).toHaveLength(1);
    expect(products[0].title).toBe("Test Product");
    expect(products[0].price).toBe("USD 99.99");
    expect(products[0].image).toBe("https://example.com/images/product.jpg");
    expect(products[0].url).toBe("https://example.com/products/test");
  });

  it("should extract multiple products from ItemList", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": [
              {
                "@type": "Product",
                "name": "Product A",
                "image": "/a.jpg",
                "url": "/products/a",
                "offers": {
                  "@type": "Offer",
                  "price": "10.00",
                  "priceCurrency": "USD"
                }
              },
              {
                "@type": "Product",
                "name": "Product B",
                "image": "/b.jpg",
                "url": "/products/b",
                "offers": {
                  "@type": "Offer",
                  "price": "20.00",
                  "priceCurrency": "USD"
                }
              }
            ]
          }
          </script>
        </head>
      </html>
    `;
    const $ = load(html);
    const baseUrl = new URL("https://example.com");
    const products = extractProductsFromJsonLd($, baseUrl);

    expect(products).toHaveLength(2);
    expect(products[0].title).toBe("Product A");
    expect(products[1].title).toBe("Product B");
  });

  it("should handle missing fields gracefully", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Incomplete Product"
          }
          </script>
        </head>
      </html>
    `;
    const $ = load(html);
    const baseUrl = new URL("https://example.com");
    const products = extractProductsFromJsonLd($, baseUrl);

    // Should not include product without required fields
    expect(products).toHaveLength(0);
  });
});
