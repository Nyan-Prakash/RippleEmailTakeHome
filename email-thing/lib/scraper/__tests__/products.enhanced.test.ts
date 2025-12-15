import { describe, it, expect } from "vitest";
import { load } from "cheerio";
import {
  extractProductsFromJsonLd,
  extractProductsFromGrid,
  extractProductFromDom,
} from "../extract/products";

describe("Enhanced Product Extraction", () => {
  describe("International Currency Support", () => {
    it("should extract price with various currency symbols", () => {
      const html = `
        <div class="product">
          <h1 class="product-title">Euro Product</h1>
          <span class="price">€99.99</span>
          <img src="/product.jpg" alt="Product">
        </div>
      `;
      const $ = load(html);
      const product = extractProductFromDom($, new URL("https://example.com"));
      
      expect(product).toBeTruthy();
      expect(product?.price).toContain("€");
      expect(product?.price).toContain("99.99");
    });

    it("should extract price with European comma format", () => {
      const html = `
        <div class="product">
          <h1 class="product-title">German Product</h1>
          <span class="price">99,99 €</span>
          <img src="/product.jpg" alt="Product">
        </div>
      `;
      const $ = load(html);
      const product = extractProductFromDom($, new URL("https://example.de"));
      
      expect(product).toBeTruthy();
      expect(product?.price).toBeTruthy();
    });

    it("should handle multiple currency codes", () => {
      const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"];
      
      currencies.forEach(currency => {
        const html = `
          <div class="product">
            <h1>Product in ${currency}</h1>
            <span class="price">${currency} 99.99</span>
            <img src="/product.jpg" alt="Product">
          </div>
        `;
        const $ = load(html);
        const product = extractProductFromDom($, new URL("https://example.com"));
        
        expect(product).toBeTruthy();
        expect(product?.price).toBeTruthy();
      });
    });
  });

  describe("Sale Price Detection", () => {
    it("should prioritize sale price over original price", () => {
      const html = `
        <div class="product">
          <h1 class="product-title">Sale Product</h1>
          <span class="price-was">$199.99</span>
          <span class="sale-price">$149.99</span>
          <img src="/product.jpg" alt="Product">
        </div>
      `;
      const $ = load(html);
      const product = extractProductFromDom($, new URL("https://example.com"));
      
      expect(product).toBeTruthy();
      expect(product?.price).toContain("149.99");
      expect(product?.price).not.toContain("199");
    });

    it("should skip strikethrough prices", () => {
      const html = `
        <div class="product">
          <h1 class="product-title">Product with Strikethrough</h1>
          <span class="price-original" style="text-decoration:line-through">$199.99</span>
          <span class="price-current">$149.99</span>
          <img src="/product.jpg" alt="Product">
        </div>
      `;
      const $ = load(html);
      const product = extractProductFromDom($, new URL("https://example.com"));
      
      expect(product).toBeTruthy();
      expect(product?.price).toContain("149.99");
      expect(product?.price).not.toContain("199");
    });

    it("should avoid compare-at prices", () => {
      const html = `
        <div class="product">
          <h1 class="product-title">Shopify Product</h1>
          <span class="price-compare">$299.99</span>
          <span class="price-current">$199.99</span>
          <img src="/product.jpg" alt="Product">
        </div>
      `;
      const $ = load(html);
      const product = extractProductFromDom($, new URL("https://example.com"));
      
      expect(product).toBeTruthy();
      expect(product?.price).toContain("199.99");
      expect(product?.price).not.toContain("299");
    });
  });

  describe("Product Grid Extraction", () => {
    it("should extract from Shopify-style product grid", () => {
      const html = `
        <div class="product-grid">
          <div class="product-item">
            <a href="/products/item1">
              <img src="/item1.jpg" alt="Item 1" class="product-image">
              <h3 class="product-title">Product 1</h3>
              <span class="price">$99.99</span>
            </a>
          </div>
          <div class="product-item">
            <a href="/products/item2">
              <img src="/item2.jpg" alt="Item 2" class="product-image">
              <h3 class="product-title">Product 2</h3>
              <span class="price">$149.99</span>
            </a>
          </div>
        </div>
      `;
      const $ = load(html);
      const products = extractProductsFromGrid($, new URL("https://example.com"));
      
      expect(products).toHaveLength(2);
      expect(products[0].title).toBe("Product 1");
      expect(products[1].title).toBe("Product 2");
    });

    it("should extract from WooCommerce product list", () => {
      const html = `
        <ul class="products">
          <li class="product type-product">
            <a href="/product/test">
              <img src="/test.jpg" alt="Test Product">
              <h2 class="woocommerce-loop-product__title">WooCommerce Product</h2>
              <span class="price">$79.99</span>
            </a>
          </li>
        </ul>
      `;
      const $ = load(html);
      const products = extractProductsFromGrid($, new URL("https://example.com"));
      
      expect(products.length).toBeGreaterThan(0);
      expect(products[0].title).toBe("WooCommerce Product");
    });

    it("should handle lazy-loaded images", () => {
      const html = `
        <div class="product-card">
          <a href="/products/lazy">
            <img data-src="/lazy-image.jpg" src="/placeholder.jpg" alt="Lazy Product" class="lazy">
            <h3>Lazy Product</h3>
            <span class="price">$59.99</span>
          </a>
        </div>
      `;
      const $ = load(html);
      const products = extractProductsFromGrid($, new URL("https://example.com"));
      
      expect(products.length).toBeGreaterThan(0);
      expect(products[0].image).toContain("lazy-image.jpg");
      expect(products[0].image).not.toContain("placeholder");
    });

    it("should prioritize main product images over thumbnails", () => {
      const html = `
        <div class="product-item">
          <a href="/products/multi-image">
            <img src="/thumb.jpg" alt="Product" width="100" height="100" class="thumbnail">
            <img src="/main.jpg" alt="Product" width="600" height="600" class="main-image">
            <h3>Multi-Image Product</h3>
            <span class="price">$129.99</span>
          </a>
        </div>
      `;
      const $ = load(html);
      const products = extractProductsFromGrid($, new URL("https://example.com"));
      
      expect(products.length).toBeGreaterThan(0);
      expect(products[0].image).toContain("main.jpg");
    });
  });

  describe("JSON-LD Enhanced Extraction", () => {
    it("should handle AggregateOffer with price range", () => {
      const html = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Variable Product",
          "image": "/variable.jpg",
          "offers": {
            "@type": "AggregateOffer",
            "lowPrice": "49.99",
            "highPrice": "99.99",
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock"
          }
        }
        </script>
      `;
      const $ = load(html);
      const products = extractProductsFromJsonLd($, new URL("https://example.com"));
      
      expect(products).toHaveLength(1);
      expect(products[0].title).toBe("Variable Product");
      expect(products[0].price).toContain("49.99"); // Should use lowPrice
    });

    it("should filter to in-stock offers", () => {
      const html = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Multi-Offer Product",
          "image": "/product.jpg",
          "offers": [
            {
              "@type": "Offer",
              "price": "199.99",
              "priceCurrency": "USD",
              "availability": "https://schema.org/OutOfStock"
            },
            {
              "@type": "Offer",
              "price": "149.99",
              "priceCurrency": "USD",
              "availability": "https://schema.org/InStock"
            }
          ]
        }
        </script>
      `;
      const $ = load(html);
      const products = extractProductsFromJsonLd($, new URL("https://example.com"));
      
      expect(products).toHaveLength(1);
      expect(products[0].price).toContain("149.99"); // Should use in-stock offer
    });

    it("should handle nested offers structure", () => {
      const html = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Nested Offer Product",
          "image": "/nested.jpg",
          "offers": {
            "@type": "AggregateOffer",
            "offers": {
              "@type": "Offer",
              "price": "79.99",
              "priceCurrency": "EUR"
            }
          }
        }
        </script>
      `;
      const $ = load(html);
      const products = extractProductsFromJsonLd($, new URL("https://example.com"));
      
      expect(products).toHaveLength(1);
      expect(products[0].price).toBeTruthy();
    });

    it("should normalize currency codes to symbols", () => {
      const html = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Currency Test Product",
          "image": "/test.jpg",
          "offers": {
            "@type": "Offer",
            "price": "99.99",
            "priceCurrency": "USD"
          }
        }
        </script>
      `;
      const $ = load(html);
      const products = extractProductsFromJsonLd($, new URL("https://example.com"));
      
      expect(products).toHaveLength(1);
      expect(products[0].price).toContain("$"); // USD should be normalized to $
    });
  });

  describe("Price Range Handling", () => {
    it("should extract first price from range", () => {
      const html = `
        <div class="product">
          <h1 class="product-title">Range Product</h1>
          <span class="price">$99 - $149</span>
          <img src="/product.jpg" alt="Product">
        </div>
      `;
      const $ = load(html);
      const product = extractProductFromDom($, new URL("https://example.com"));
      
      expect(product).toBeTruthy();
      expect(product?.price).toBeTruthy();
      // Should extract the first/lower price
    });

    it("should handle 'from' pricing", () => {
      const html = `
        <div class="product">
          <h1 class="product-title">From Price Product</h1>
          <span class="price">From $79.99</span>
          <img src="/product.jpg" alt="Product">
        </div>
      `;
      const $ = load(html);
      const product = extractProductFromDom($, new URL("https://example.com"));
      
      expect(product).toBeTruthy();
      expect(product?.price).toContain("79.99");
    });
  });

  describe("Edge Cases", () => {
    it("should handle products with no price", () => {
      const html = `
        <div class="product-item">
          <a href="/products/no-price">
            <img src="/item.jpg" alt="No Price Item">
            <h3>No Price Product</h3>
          </a>
        </div>
      `;
      const $ = load(html);
      const products = extractProductsFromGrid($, new URL("https://example.com"));
      
      if (products.length > 0) {
        expect(products[0].price).toBe("N/A");
      }
    });

    it("should deduplicate products with same URL", () => {
      const html = `
        <div class="product-grid">
          <div class="product-item">
            <a href="/products/duplicate">
              <img src="/dup1.jpg" alt="Duplicate">
              <h3>Duplicate Product</h3>
              <span class="price">$99.99</span>
            </a>
          </div>
          <div class="product-item">
            <a href="/products/duplicate">
              <img src="/dup2.jpg" alt="Duplicate">
              <h3>Duplicate Product</h3>
              <span class="price">$99.99</span>
            </a>
          </div>
        </div>
      `;
      const $ = load(html);
      const products = extractProductsFromGrid($, new URL("https://example.com"));
      
      // Should only include one instance
      const duplicateUrls = products.filter(p => p.url.includes("/products/duplicate"));
      expect(duplicateUrls).toHaveLength(1);
    });

    it("should handle products with very long prices", () => {
      const html = `
        <div class="product">
          <h1 class="product-title">Large Price Product</h1>
          <span class="price">$123,456.78</span>
          <img src="/product.jpg" alt="Product">
        </div>
      `;
      const $ = load(html);
      const product = extractProductFromDom($, new URL("https://example.com"));
      
      expect(product).toBeTruthy();
      expect(product?.price).toContain("123");
    });
  });
});
