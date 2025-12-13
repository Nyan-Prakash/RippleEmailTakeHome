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

  // Extract price with multiple fallbacks and validation
  let price = "";
  if (item.offers) {
    const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;

    // Try different price fields
    let priceValue = offers.price || offers.lowPrice || offers.highPrice;

    // Handle price ranges - prefer lowPrice for consistency
    if (!priceValue && offers.priceSpecification) {
      priceValue = offers.priceSpecification.price;
    }

    if (priceValue) {
      // Validate it's a valid number
      const numPrice = parseFloat(String(priceValue).replace(/[^0-9.]/g, ""));
      if (!isNaN(numPrice) && numPrice > 0) {
        const currency = offers.priceCurrency || "";
        price = currency ? `${currency} ${priceValue}` : String(priceValue);
      }
    }
  }

  // Fallback to direct price field
  if (!price && item.price) {
    const numPrice = parseFloat(String(item.price).replace(/[^0-9.]/g, ""));
    if (!isNaN(numPrice) && numPrice > 0) {
      price = String(item.price);
    }
  }

  // Extract image with multiple fallbacks
  let image = "";
  if (item.image) {
    const imageData = Array.isArray(item.image) ? item.image[0] : item.image;
    if (typeof imageData === "string") {
      image = imageData;
    } else if (imageData?.url) {
      image = imageData.url;
    } else if (imageData?.contentUrl) {
      image = imageData.contentUrl;
    }
  }

  // Resolve image URL and validate
  if (image) {
    const resolved = resolveUrl(image, pageUrl);
    if (resolved && isValidImageUrl(resolved.toString())) {
      image = resolved.toString();
    } else {
      image = "";
    }
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
  // Try to find product title with comprehensive selectors
  const titleSelectors = [
    'h1[class*="product"]',
    'h1[class*="title"]',
    '[class*="product-title"]',
    '[data-product-title]',
    '[itemprop="name"]',
    'meta[property="og:title"]',
    'h1',
  ];

  let title = "";
  for (const selector of titleSelectors) {
    const text =
      $(selector).attr("content") || $(selector).first().text().trim();
    if (text && text.length > 0 && text.length < 200) {
      title = text;
      break;
    }
  }

  if (!title) return null;

  // Try to find price with comprehensive patterns
  const price = extractPrice($);

  // Try to find main product image with quality scoring
  const image = extractBestProductImage($, pageUrl);

  if (!image) return null;

  return {
    id: nanoid(),
    title,
    price: price || "N/A",
    image,
    url: pageUrl.toString(),
  };
}

/**
 * Extract price from DOM with comprehensive patterns and validation
 */
function extractPrice($: CheerioAPI): string {
  // Strategy 1: Try structured data first (most reliable)
  const structuredPrice = extractStructuredPrice($);
  if (structuredPrice) return structuredPrice;

  // Strategy 2: Try meta tags
  const metaPrice = extractMetaPrice($);
  if (metaPrice) return metaPrice;

  // Strategy 3: Try DOM selectors with priority ordering
  const priceSelectors = [
    // High priority - specific current/sale price
    '[class*="sale-price"]:not([class*="original"]):not([class*="was"])',
    '[class*="current-price"]:not([class*="original"]):not([class*="was"])',
    '[class*="final-price"]:not([class*="original"]):not([class*="was"])',
    '[class*="offer-price"]:not([class*="original"]):not([class*="was"])',
    '[data-product-price]',
    '[data-price]:not([data-price-type="original"])',
    '[data-sale-price]',

    // Medium priority - general price selectors
    '.price:not(.price-was):not(.price-original)',
    '[class*="product-price"]:not([class*="original"]):not([class*="was"])',
    '[itemprop="price"]',
    'span[class*="price"]:not([class*="original"]):not([class*="was"]):not([class*="compare"])',

    // Lower priority - broader selectors
    '[class*="price"]',
    '.price',
  ];

  for (const selector of priceSelectors) {
    const elements = $(selector);

    // Try each matching element
    elements.each((_, elem) => {
      const $elem = $(elem);

      // Skip if this is clearly an old/original price
      const className = ($elem.attr("class") || "").toLowerCase();
      const id = ($elem.attr("id") || "").toLowerCase();
      if (className.includes("was") || className.includes("original") ||
          className.includes("compare") || className.includes("old") ||
          id.includes("was") || id.includes("original")) {
        return; // continue to next element
      }

      let priceText =
        $elem.attr("content") ||
        $elem.attr("data-price") ||
        $elem.attr("data-product-price") ||
        $elem.text().trim();

      if (priceText) {
        const cleaned = cleanAndExtractPrice(priceText);
        if (cleaned) {
          return false; // break the loop by returning the price
        }
      }
    });

    // Check if we found a price from this selector
    const testPrice = elements.first().text().trim();
    if (testPrice) {
      const cleaned = cleanAndExtractPrice(testPrice);
      if (cleaned) return cleaned;
    }
  }

  return "N/A";
}

/**
 * Extract price from structured data (Schema.org)
 */
function extractStructuredPrice($: CheerioAPI): string | null {
  const priceValue = $('[itemprop="price"]').attr("content");
  const currency = $('[itemprop="priceCurrency"]').attr("content");

  if (priceValue) {
    // Validate it's a valid number
    const numPrice = parseFloat(priceValue.replace(/[^0-9.]/g, ""));
    if (!isNaN(numPrice) && numPrice > 0) {
      return currency ? `${currency} ${priceValue}` : priceValue;
    }
  }

  return null;
}

/**
 * Extract price from meta tags
 */
function extractMetaPrice($: CheerioAPI): string | null {
  const metaSelectors = [
    'meta[property="og:price:amount"]',
    'meta[property="product:price:amount"]',
    'meta[property="product:price"]',
    'meta[name="price"]',
  ];

  for (const selector of metaSelectors) {
    const content = $(selector).attr("content");
    if (content) {
      const currency =
        $('meta[property="og:price:currency"]').attr("content") ||
        $('meta[property="product:price:currency"]').attr("content");

      const cleaned = cleanAndExtractPrice(content);
      if (cleaned) {
        return currency ? `${currency} ${cleaned}` : cleaned;
      }
    }
  }

  return null;
}

/**
 * Clean and extract price from raw text with comprehensive patterns
 */
function cleanAndExtractPrice(rawText: string): string | null {
  if (!rawText || rawText.length === 0) return null;

  // Remove extra whitespace
  let text = rawText.replace(/\s+/g, " ").trim();

  // Remove common non-price text
  text = text.replace(/from/gi, "");
  text = text.replace(/starting at/gi, "");
  text = text.replace(/as low as/gi, "");

  // Comprehensive currency patterns (symbol or code)
  const currencyPatterns = [
    // Major currencies with symbols
    { regex: /\$\s*[\d,]+(?:\.\d{2})?/, symbol: "$" },
    { regex: /£\s*[\d,]+(?:\.\d{2})?/, symbol: "£" },
    { regex: /€\s*[\d,]+(?:\.\d{2})?/, symbol: "€" },
    { regex: /¥\s*[\d,]+(?:\.\d{2})?/, symbol: "¥" },
    { regex: /₹\s*[\d,]+(?:\.\d{2})?/, symbol: "₹" },
    { regex: /₽\s*[\d,]+(?:\.\d{2})?/, symbol: "₽" },
    { regex: /R\$\s*[\d,]+(?:\.\d{2})?/, symbol: "R$" },
    { regex: /kr\s*[\d,]+(?:\.\d{2})?/, symbol: "kr" },

    // Currency codes (3-letter ISO codes)
    { regex: /USD\s*[\d,]+(?:\.\d{2})?/i, symbol: "USD" },
    { regex: /EUR\s*[\d,]+(?:\.\d{2})?/i, symbol: "EUR" },
    { regex: /GBP\s*[\d,]+(?:\.\d{2})?/i, symbol: "GBP" },
    { regex: /CAD\s*[\d,]+(?:\.\d{2})?/i, symbol: "CAD" },
    { regex: /AUD\s*[\d,]+(?:\.\d{2})?/i, symbol: "AUD" },
    { regex: /JPY\s*[\d,]+(?:\.\d{2})?/i, symbol: "JPY" },
    { regex: /INR\s*[\d,]+(?:\.\d{2})?/i, symbol: "INR" },
    { regex: /CNY\s*[\d,]+(?:\.\d{2})?/i, symbol: "CNY" },

    // Reversed (number before currency)
    { regex: /[\d,]+(?:\.\d{2})?\s*USD/i, symbol: "USD" },
    { regex: /[\d,]+(?:\.\d{2})?\s*EUR/i, symbol: "EUR" },
    { regex: /[\d,]+(?:\.\d{2})?\s*GBP/i, symbol: "GBP" },
    { regex: /[\d,]+(?:\.\d{2})?\s*CAD/i, symbol: "CAD" },
    { regex: /[\d,]+(?:\.\d{2})?\s*AUD/i, symbol: "AUD" },
  ];

  // Try currency patterns
  for (const { regex, symbol } of currencyPatterns) {
    const match = text.match(regex);
    if (match) {
      let price = match[0].trim();
      // Ensure currency symbol is present
      if (!price.includes(symbol)) {
        price = `${symbol} ${price}`;
      }
      return price;
    }
  }

  // Fallback: Look for any number that looks like a price
  // Must have at least 2 digits and optionally decimals
  const numberPatterns = [
    /\d{2,}[,.]?\d*(?:\.\d{2})?/,  // e.g., 99, 99.99, 1,234.56
    /\d{1,3}(?:,\d{3})+(?:\.\d{2})?/,  // e.g., 1,234.56
  ];

  for (const pattern of numberPatterns) {
    const match = text.match(pattern);
    if (match) {
      const numberStr = match[0];
      // Validate it's a reasonable price (not a year, phone number, etc.)
      const numValue = parseFloat(numberStr.replace(/,/g, ""));
      if (!isNaN(numValue) && numValue > 0 && numValue < 1000000) {
        return numberStr;
      }
    }
  }

  return null;
}

/**
 * Extract best product image with quality scoring
 */
function extractBestProductImage(
  $: CheerioAPI,
  pageUrl: URL
): string | null {
  interface ImageCandidate {
    url: string;
    score: number;
  }

  const candidates: ImageCandidate[] = [];

  // 1. Check Open Graph image (usually high quality)
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) {
    const resolved = resolveUrl(ogImage, pageUrl);
    if (resolved && isValidImageUrl(resolved.toString())) {
      candidates.push({ url: resolved.toString(), score: 100 });
    }
  }

  // 2. Check Twitter card image
  const twitterImage = $('meta[name="twitter:image"]').attr("content");
  if (twitterImage) {
    const resolved = resolveUrl(twitterImage, pageUrl);
    if (resolved && isValidImageUrl(resolved.toString())) {
      candidates.push({ url: resolved.toString(), score: 95 });
    }
  }

  // 3. Check structured data image
  const schemaImage = $('[itemprop="image"]').attr("content") || $('[itemprop="image"]').attr("src");
  if (schemaImage) {
    const resolved = resolveUrl(schemaImage, pageUrl);
    if (resolved && isValidImageUrl(resolved.toString())) {
      candidates.push({ url: resolved.toString(), score: 90 });
    }
  }

  // 4. Scan for product images with scoring
  const imgSelectors = [
    'img[class*="product"][class*="main"]',
    'img[class*="product"][class*="primary"]',
    'img[class*="product"][class*="featured"]',
    'img[class*="product-image"]',
    'img[class*="main-image"]',
    'img[class*="featured"]',
    '[class*="product-gallery"] img',
    '[class*="product-image"] img',
    '[data-product-image] img',
    'img[class*="product"]',
    'img[alt*="product"]',
  ];

  for (const selector of imgSelectors) {
    $(selector).each((_, elem) => {
      const src =
        $(elem).attr("src") ||
        $(elem).attr("data-src") ||
        $(elem).attr("data-original") ||
        $(elem).attr("data-lazy") ||
        $(elem).attr("data-srcset")?.split(",")[0]?.split(" ")[0];

      if (src) {
        const resolved = resolveUrl(src, pageUrl);
        if (resolved && isValidImageUrl(resolved.toString())) {
          const url = resolved.toString();
          // Score based on selector specificity
          const baseScore = imgSelectors.indexOf(selector) * -5 + 80;
          const sizeScore = scoreImageBySize(url);
          const score = baseScore + sizeScore;

          // Avoid duplicates
          if (!candidates.find((c) => c.url === url)) {
            candidates.push({ url, score });
          }
        }
      }
    });
  }

  // 5. Sort by score and return the best
  candidates.sort((a, b) => b.score - a.score);

  return candidates.length > 0 ? candidates[0].url : null;
}

/**
 * Score image based on URL hints about size/quality
 */
function scoreImageBySize(url: string): number {
  let score = 0;

  // Prefer larger sizes indicated in URL
  if (url.match(/large|original|master|full|1200|1500|2000/i)) score += 20;
  if (url.match(/medium|800|1000/i)) score += 10;
  if (url.match(/small|thumb|thumbnail|icon|100|200|300/i)) score -= 20;

  // Prefer certain file formats
  if (url.match(/\.(jpg|jpeg|png|webp)$/i)) score += 5;

  return score;
}

/**
 * Validate if URL looks like a valid image
 */
function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false;

  // Must be http/https
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;

  // Exclude common non-image patterns
  if (url.includes("logo") && !url.includes("product")) return false;
  if (url.includes("placeholder")) return false;
  if (url.includes("icon.") && !url.includes("product")) return false;
  if (url.includes("1x1")) return false;
  if (url.includes("blank.")) return false;

  // Prefer URLs that look like product images
  const imageExtensions = /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i;
  if (imageExtensions.test(url)) return true;

  // Allow URLs with image-like patterns even without extension
  if (url.includes("/products/") || url.includes("/product-images/")) return true;

  return false;
}

/**
 * Extract products from a product listing/grid page
 * Detects product cards in grids, lists, and collections
 */
export function extractProductsFromGrid(
  $: CheerioAPI,
  pageUrl: URL
): ProductCandidate[] {
  const products: ProductCandidate[] = [];
  const seen = new Set<string>();

  // Strategy 1: Find product containers with comprehensive selectors
  const productContainerSelectors = [
    '[class*="product-item"]',
    '[class*="product-card"]',
    '[class*="product-grid-item"]',
    '[class*="collection-item"]',
    '[data-product-id]',
    '[data-product]',
    '.product',
    '[class*="grid-product"]',
    '[class*="product-tile"]',
    'article[class*="product"]',
    'li[class*="product"]',
  ];

  for (const containerSelector of productContainerSelectors) {
    $(containerSelector).each((_, container) => {
      const $container = $(container);

      // Extract product URL
      let productUrl = "";
      const $link = $container.find('a[href]').first();
      if ($link.length) {
        const href = $link.attr("href");
        if (href) {
          const resolved = resolveUrl(href, pageUrl);
          if (resolved) {
            productUrl = resolved.toString();
          }
        }
      }

      if (!productUrl || seen.has(productUrl)) return;

      // Extract title
      let title = "";
      const titleSelectors = [
        '[class*="product-title"]',
        '[class*="product-name"]',
        '[class*="title"]',
        'h2',
        'h3',
        'h4',
        '[itemprop="name"]',
      ];

      for (const selector of titleSelectors) {
        const text = $container.find(selector).first().text().trim();
        if (text && text.length > 0 && text.length < 200) {
          title = text;
          break;
        }
      }

      // If still no title, try link text
      if (!title) {
        title = $link.text().trim();
      }

      if (!title) return;

      // Extract price with enhanced extraction
      let price = "";
      const priceSelectors = [
        '[class*="sale-price"]:not([class*="original"]):not([class*="was"])',
        '[class*="current-price"]:not([class*="original"]):not([class*="was"])',
        '[class*="final-price"]',
        '[data-product-price]',
        '[data-price]:not([data-price-type="original"])',
        '[itemprop="price"]',
        'span[class*="price"]:not([class*="original"]):not([class*="was"])',
        '[class*="price"]',
        '.price',
      ];

      for (const selector of priceSelectors) {
        const $priceElem = $container.find(selector).first();

        // Skip if it's an old/original price
        const className = ($priceElem.attr("class") || "").toLowerCase();
        if (className.includes("was") || className.includes("original") || className.includes("compare")) {
          continue;
        }

        const priceText =
          $priceElem.attr("content") ||
          $priceElem.attr("data-price") ||
          $priceElem.text().trim();

        if (priceText && /\d/.test(priceText)) {
          const cleaned = cleanAndExtractPrice(priceText);
          if (cleaned) {
            price = cleaned;
            break;
          }
        }
      }

      // Extract image
      let image = "";
      const $img = $container.find("img").first();
      if ($img.length) {
        const src =
          $img.attr("src") ||
          $img.attr("data-src") ||
          $img.attr("data-original") ||
          $img.attr("data-lazy") ||
          $img.attr("data-srcset")?.split(",")[0]?.split(" ")[0];

        if (src) {
          const resolved = resolveUrl(src, pageUrl);
          if (resolved && isValidImageUrl(resolved.toString())) {
            image = resolved.toString();
          }
        }
      }

      // Only add if we have all required fields
      if (title && productUrl && image) {
        seen.add(productUrl);
        products.push({
          id: nanoid(),
          title,
          price: price || "N/A",
          image,
          url: productUrl,
        });
      }
    });

    // If we found products with this selector, we can stop trying others
    if (products.length > 0) break;
  }

  // Strategy 2: If no products found, try finding product cards by structure
  if (products.length === 0) {
    // Look for containers with both image and link
    $("a[href]").each((_, elem) => {
      const $link = $(elem);
      const $img = $link.find("img").first();

      if (!$img.length) return;

      const href = $link.attr("href") || "";
      const resolved = resolveUrl(href, pageUrl);
      if (!resolved) return;

      const productUrl = resolved.toString();
      if (seen.has(productUrl)) return;

      // Check if URL looks like a product
      const path = resolved.pathname.toLowerCase();
      if (!path.includes("/product") && !path.includes("/p/") && !path.includes("/item")) {
        return;
      }

      const src =
        $img.attr("src") ||
        $img.attr("data-src") ||
        $img.attr("data-original");

      if (!src) return;

      const imageResolved = resolveUrl(src, pageUrl);
      if (!imageResolved || !isValidImageUrl(imageResolved.toString())) return;

      const image = imageResolved.toString();
      const title = $img.attr("alt") || $link.text().trim() || "Product";

      if (title && title.length > 0 && title.length < 200) {
        seen.add(productUrl);
        products.push({
          id: nanoid(),
          title,
          price: "N/A",
          image,
          url: productUrl,
        });
      }
    });
  }

  return products;
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
