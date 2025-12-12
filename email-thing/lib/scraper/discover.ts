import type { CheerioAPI } from "cheerio";
import { isSameOrigin, resolveUrl } from "./url";

/**
 * Candidate product or collection URL with metadata
 */
export interface UrlCandidate {
  url: string;
  score: number;
  type: "product" | "collection";
}

/**
 * Discover product and collection URLs from a page
 */
export function discoverLinks(
  $: CheerioAPI,
  baseUrl: URL
): {
  products: UrlCandidate[];
  collections: UrlCandidate[];
} {
  const products: UrlCandidate[] = [];
  const collections: UrlCandidate[] = [];
  const seen = new Set<string>();

  // First, check JSON-LD for structured data
  const jsonLdLinks = extractLinksFromJsonLd($, baseUrl);
  jsonLdLinks.products.forEach((url) => {
    if (!seen.has(url)) {
      seen.add(url);
      products.push({ url, score: 10, type: "product" }); // High score for JSON-LD
    }
  });
  jsonLdLinks.collections.forEach((url) => {
    if (!seen.has(url)) {
      seen.add(url);
      collections.push({ url, score: 10, type: "collection" });
    }
  });

  // Then scan all <a> tags
  $("a[href]").each((_, elem) => {
    const href = $(elem).attr("href");
    if (!href) return;

    const resolved = resolveUrl(href, baseUrl);
    if (!resolved || !isSameOrigin(resolved, baseUrl)) return;

    const urlStr = resolved.toString();
    if (seen.has(urlStr)) return;

    const path = resolved.pathname.toLowerCase();
    const text = $(elem).text().trim().toLowerCase();

    // Check for product patterns
    if (
      path.includes("/product/") ||
      path.includes("/products/") ||
      path.includes("/p/")
    ) {
      seen.add(urlStr);
      products.push({
        url: urlStr,
        score: scoreProductUrl(path, text),
        type: "product",
      });
    }

    // Check for collection/category patterns
    if (
      path.includes("/collection") ||
      path.includes("/category") ||
      path.includes("/shop") ||
      path.includes("/catalog")
    ) {
      seen.add(urlStr);
      collections.push({
        url: urlStr,
        score: scoreCollectionUrl(path, text),
        type: "collection",
      });
    }
  });

  // Sort by score descending
  products.sort((a, b) => b.score - a.score);
  collections.sort((a, b) => b.score - a.score);

  return { products, collections };
}

/**
 * Extract product and collection links from JSON-LD
 */
function extractLinksFromJsonLd(
  $: CheerioAPI,
  baseUrl: URL
): { products: string[]; collections: string[] } {
  const products: string[] = [];
  const collections: string[] = [];

  $('script[type="application/ld+json"]').each((_, elem) => {
    try {
      const json = JSON.parse($(elem).html() || "{}");

      // Handle arrays of objects
      const items = Array.isArray(json) ? json : [json];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;

        // Check for Product
        if (item["@type"] === "Product" && item.url) {
          const resolved = resolveUrl(item.url, baseUrl);
          if (resolved && isSameOrigin(resolved, baseUrl)) {
            products.push(resolved.toString());
          }
        }

        // Check for ItemList (collections)
        if (item["@type"] === "ItemList" && item.url) {
          const resolved = resolveUrl(item.url, baseUrl);
          if (resolved && isSameOrigin(resolved, baseUrl)) {
            collections.push(resolved.toString());
          }
        }

        // Check for nested products in ItemList
        if (
          item["@type"] === "ItemList" &&
          Array.isArray(item.itemListElement)
        ) {
          for (const elem of item.itemListElement) {
            if (elem.url) {
              const resolved = resolveUrl(elem.url, baseUrl);
              if (resolved && isSameOrigin(resolved, baseUrl)) {
                products.push(resolved.toString());
              }
            }
          }
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  });

  return {
    products: [...new Set(products)],
    collections: [...new Set(collections)],
  };
}

/**
 * Score a product URL (higher is better)
 */
function scoreProductUrl(path: string, linkText: string): number {
  let score = 1;

  // Prefer /products/ over /product/
  if (path.includes("/products/")) score += 3;
  else if (path.includes("/product/")) score += 2;

  // Boost if link text suggests it's a product
  if (linkText.length > 0 && linkText.length < 100) {
    score += 1;
  }

  // Penalize if path has too many segments (likely not a product detail page)
  const segments = path.split("/").filter(Boolean);
  if (segments.length > 4) score -= 2;

  return Math.max(score, 0);
}

/**
 * Score a collection URL (higher is better)
 */
function scoreCollectionUrl(path: string, linkText: string): number {
  let score = 1;

  // Prefer specific patterns
  if (path.includes("/collections/")) score += 3;
  else if (path.includes("/collection/")) score += 2;
  else if (path.includes("/shop")) score += 2;

  // Boost if link text is short and clear
  if (linkText.length > 0 && linkText.length < 50) {
    score += 1;
  }

  return Math.max(score, 0);
}

/**
 * Select top candidates with limits
 */
export function selectTopCandidates(options: {
  products: UrlCandidate[];
  collections: UrlCandidate[];
  maxProducts?: number;
  maxCollections?: number;
}): {
  products: string[];
  collection: string | null;
} {
  const maxProducts = options.maxProducts ?? 4;
  const maxCollections = options.maxCollections ?? 1;

  const products = options.products.slice(0, maxProducts).map((c) => c.url);
  const collection = options.collections[0]?.url ?? null;

  return { products, collection };
}
