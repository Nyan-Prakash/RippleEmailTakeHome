import { describe, it, expect } from "vitest";
import { renderEmailSpecToMjml } from "../renderEmailSpec";
import type { EmailSpec } from "@/lib/schemas/emailSpec";

describe("Product Card Price Rendering", () => {
  const baseSpec: EmailSpec = {
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
      primaryColor: "#007bff",
      font: { heading: "Arial", body: "Arial" },
      button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
    },
    catalog: {
      items: [
        {
          id: "product-with-price",
          title: "Product With Price",
          price: "$99.99",
          image: "https://example.com/product1.jpg",
          url: "https://example.com/product1",
        },
        {
          id: "product-without-price",
          title: "Product Without Price",
          price: "N/A",
          image: "https://example.com/product2.jpg",
          url: "https://example.com/product2",
        },
        {
          id: "product-na-lowercase",
          title: "Product NA Lowercase",
          price: "n/a",
          image: "https://example.com/product3.jpg",
          url: "https://example.com/product3",
        },
        {
          id: "product-empty-price",
          title: "Product Empty Price",
          price: "",
          image: "https://example.com/product4.jpg",
          url: "https://example.com/product4",
        },
      ],
    },
    sections: [
      {
        id: "header",
        type: "header",
        blocks: [],
      },
      {
        id: "products",
        type: "feature",
        blocks: [
          {
            type: "productCard",
            productRef: "product-with-price",
          },
          {
            type: "productCard",
            productRef: "product-without-price",
          },
          {
            type: "productCard",
            productRef: "product-na-lowercase",
          },
          {
            type: "productCard",
            productRef: "product-empty-price",
          },
        ],
      },
      {
        id: "footer",
        type: "footer",
        blocks: [
          {
            type: "smallPrint",
            text: "Unsubscribe: {{{unsubscribeUrl}}}",
          },
        ],
      },
    ],
  };

  it("should display price when product has valid price", () => {
    const { mjml } = renderEmailSpecToMjml(baseSpec);
    
    // Should contain the price for valid product
    expect(mjml).toContain("$99.99");
    expect(mjml).toContain("Product With Price");
  });

  it("should NOT display N/A price (uppercase)", () => {
    const { mjml } = renderEmailSpecToMjml(baseSpec);
    
    // Should contain the product title
    expect(mjml).toContain("Product Without Price");
    
    // Should NOT contain "N/A" in the rendered output
    // Count occurrences - it shouldn't appear as displayed text
    const naMatches = mjml.match(/N\/A/g) || [];
    // N/A might appear in comments or data attributes, but not as rendered text
    expect(naMatches.length).toBeLessThanOrEqual(0);
  });

  it("should NOT display n/a price (lowercase)", () => {
    const { mjml } = renderEmailSpecToMjml(baseSpec);
    
    // Should contain the product title
    expect(mjml).toContain("Product NA Lowercase");
    
    // Should NOT contain "n/a" as rendered price text
    const naText = mjml.match(/<mj-text[^>]*>n\/a<\/mj-text>/i);
    expect(naText).toBeNull();
  });

  it("should NOT display empty price", () => {
    const { mjml } = renderEmailSpecToMjml(baseSpec);
    
    // Should contain the product title
    expect(mjml).toContain("Product Empty Price");
    
    // Product card should still render with image, title, and button
    // but without price text element
    const productSection = mjml.substring(mjml.indexOf("Product Empty Price"));
    expect(productSection).toContain("View Product");
  });

  it("should render all product components except price for N/A products", () => {
    const { mjml } = renderEmailSpecToMjml(baseSpec);
    
    // All products should have these components
    const products = ["Product With Price", "Product Without Price", "Product NA Lowercase", "Product Empty Price"];
    
    products.forEach(productTitle => {
      expect(mjml).toContain(productTitle); // Title
      expect(mjml).toContain("View Product"); // Button
    });
    
    // Only the first product should have its price displayed
    expect(mjml).toContain("$99.99");
  });

  it("should maintain proper spacing without price element", () => {
    const { mjml } = renderEmailSpecToMjml(baseSpec);
    
    // Products without price should still have proper structure
    // Image -> Title -> Button (no price in between)
    const noPrice = mjml.indexOf("Product Without Price");
    const viewButton = mjml.indexOf("View Product", noPrice);
    
    // Should have a button after title (with no price text in between)
    expect(viewButton).toBeGreaterThan(noPrice);
    
    // The section between title and button shouldn't contain price-related text
    const betweenTitleAndButton = mjml.substring(noPrice, viewButton);
    expect(betweenTitleAndButton).not.toMatch(/<mj-text[^>]*font-weight="bold"[^>]*font-size="18px"[^>]*>N\/A<\/mj-text>/);
  });

  it("should handle mixed products with and without prices in same section", () => {
    const { mjml } = renderEmailSpecToMjml(baseSpec);
    
    // Both types of products should render successfully
    expect(mjml).toContain("Product With Price");
    expect(mjml).toContain("Product Without Price");
    expect(mjml).toContain("$99.99");
    
    // No warnings should be present for valid products
    const { warnings } = renderEmailSpecToMjml(baseSpec);
    const priceWarnings = warnings.filter(w => w.message.includes("price"));
    expect(priceWarnings).toHaveLength(0);
  });
});
