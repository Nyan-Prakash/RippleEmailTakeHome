import type { CheerioAPI } from "cheerio";
import { nanoid } from "nanoid";
import { resolveUrl } from "../url";

/**
 * Product candidate (before validation)
 */
export interface ProductCandidate {
  id: string;
  title: string;
  price: string;
  image: string;
  url: string;
}

/**
 * Extract products from JSON-LD structured data
 */
export function extractProductsFromJsonLd(
  $: CheerioAPI,
  pageUrl: URL
): ProductCandidate[] {
  const products: ProductCandidate[] = [];

  $('script[type="application/ld+json"]').each((_, elem) => {
    try {
      const json = JSON.parse($(elem).html() || "{}");
      const items = Array.isArray(json) ? json : [json];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;

        // Handle Product type
        if (item["@type"] === "Product") {
          const product = parseProductJsonLd(item, pageUrl);
          if (product) products.push(product);
        }

        // Handle ItemList with products
        if (
          item["@type"] === "ItemList" &&
          Array.isArray(item.itemListElement)
        ) {
          for (const elem of item.itemListElement) {
            if (elem["@type"] === "Product") {
              const product = parseProductJsonLd(elem, pageUrl);
              if (product) products.push(product);
            }
          }
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  });

  return products;
}

/**
 * Parse a single Product JSON-LD object
 */
function parseProductJsonLd(item: any, pageUrl: URL): ProductCandidate | null {
  const title = item.name || "";
  if (!title) return null;

  // Extract price
  let price = "";
  if (item.offers) {
    const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
    if (offers.price) {
      const currency = offers.priceCurrency || "";
      price = currency ? `${currency} ${offers.price}` : String(offers.price);
    }
  }

  // Extract image
  let image = "";
  if (item.image) {
    const imageData = Array.isArray(item.image) ? item.image[0] : item.image;
    if (typeof imageData === "string") {
      image = imageData;
    } else if (imageData?.url) {
      image = imageData.url;
    }
  }

  // Resolve image URL
  if (image) {
    const resolved = resolveUrl(image, pageUrl);
    if (resolved) image = resolved.toString();
  }

  // Product URL
  let url = item.url || pageUrl.toString();
  const resolvedUrl = resolveUrl(url, pageUrl);
  if (resolvedUrl) url = resolvedUrl.toString();

  if (!title || !image || !url) return null;

  return {
    id: nanoid(),
    title,
    price: price || "N/A",
    image,
    url,
  };
}

/**
 * Extract product from a product detail page DOM
 */
export function extractProductFromDom(
  $: CheerioAPI,
  pageUrl: URL
): ProductCandidate | null {
  // Try to find product title
  const title =
    $('h1[class*="product"]').first().text().trim() ||
    $('h1[class*="title"]').first().text().trim() ||
    $("h1").first().text().trim();

  if (!title) return null;

  // Try to find price
  const price =
    $('[class*="price"]').first().text().trim() ||
    $("[data-price]").first().text().trim() ||
    "N/A";

  // Try to find main product image
  let image = "";
  const imgSelectors = [
    'img[class*="product"]',
    'img[class*="main"]',
    'img[class*="featured"]',
    ".product-image img",
    'meta[property="og:image"]',
  ];

  for (const selector of imgSelectors) {
    const src =
      $(selector).attr("src") ||
      $(selector).attr("content") ||
      $(selector).attr("data-src");
    if (src) {
      const resolved = resolveUrl(src, pageUrl);
      if (resolved) {
        image = resolved.toString();
        break;
      }
    }
  }

  if (!image) return null;

  return {
    id: nanoid(),
    title,
    price,
    image,
    url: pageUrl.toString(),
  };
}

/**
 * Merge and deduplicate products
 */
export function mergeAndDedupeProducts(
  products: ProductCandidate[]
): ProductCandidate[] {
  const seen = new Set<string>();
  const unique: ProductCandidate[] = [];

  for (const product of products) {
    // Create a key based on title + URL for deduplication
    const key = `${product.title.toLowerCase()}|${product.url}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(product);
    }
  }

  return unique;
}
