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
 * ENHANCED: Better handling of offer variations, price ranges, and availability
 */
function parseProductJsonLd(item: any, pageUrl: URL): ProductCandidate | null {
  const title = item.name || "";
  if (!title) return null;

  // Extract price with multiple fallbacks and validation
  let price = "";
  if (item.offers) {
    // Handle multiple offers - prioritize in-stock, lowest price
    let offersList = Array.isArray(item.offers) ? item.offers : [item.offers];
    
    // Filter to in-stock offers if availability info is present
    const inStockOffers = offersList.filter((o: any) => {
      const availability = o.availability || "";
      return !availability || 
             availability.includes("InStock") || 
             availability.includes("PreOrder") ||
             availability.includes("OnlineOnly");
    });
    
    if (inStockOffers.length > 0) {
      offersList = inStockOffers;
    }
    
    // Get the first/best offer
    const offers = offersList[0];

    // Try different price fields with priority
    let priceValue = offers.price || offers.lowPrice || offers.highPrice;
    let currency = offers.priceCurrency || "";

    // Handle AggregateOffer type (has lowPrice/highPrice)
    if (offers["@type"] === "AggregateOffer") {
      priceValue = offers.lowPrice || offers.highPrice || offers.price;
    }

    // Handle price ranges - prefer lowPrice for consistency
    if (!priceValue && offers.priceSpecification) {
      if (Array.isArray(offers.priceSpecification)) {
        priceValue = offers.priceSpecification[0]?.price;
        currency = offers.priceSpecification[0]?.priceCurrency || currency;
      } else {
        priceValue = offers.priceSpecification.price;
        currency = offers.priceSpecification.priceCurrency || currency;
      }
    }

    // Handle nested offers
    if (!priceValue && offers.offers) {
      const nestedOffer = Array.isArray(offers.offers) ? offers.offers[0] : offers.offers;
      priceValue = nestedOffer.price || nestedOffer.lowPrice;
      currency = nestedOffer.priceCurrency || currency;
    }

    if (priceValue) {
      // Clean and validate the price value
      const priceStr = String(priceValue);
      const numPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
      
      if (!isNaN(numPrice) && numPrice > 0) {
        // Format with currency if available
        if (currency) {
          // Normalize common currency codes to symbols
          const currencySymbols: Record<string, string> = {
            'USD': '$', 'CAD': 'C$', 'AUD': 'A$',
            'GBP': '£', 'EUR': '€', 'JPY': '¥',
            'CNY': '¥', 'INR': '₹', 'RUB': '₽'
          };
          const symbol = currencySymbols[currency] || currency;
          
          // Format the price nicely
          if (priceStr.includes(".")) {
            price = `${symbol}${numPrice.toFixed(2)}`;
          } else {
            price = `${symbol}${numPrice}`;
          }
        } else {
          price = String(priceValue);
        }
      }
    }
  }

  // Fallback to direct price field
  if (!price && item.price) {
    const priceStr = String(item.price);
    const numPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
    if (!isNaN(numPrice) && numPrice > 0) {
      price = priceStr.includes(".") ? `$${numPrice.toFixed(2)}` : `$${numPrice}`;
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
 * ENHANCED: Better sale price detection, strikethrough price avoidance, and scoring system
 * EXPORTED: Now available for web search enhancement
 */
export function extractPrice($: CheerioAPI): string {
  // Strategy 1: Try structured data first (most reliable)
  const structuredPrice = extractStructuredPrice($);
  if (structuredPrice) return structuredPrice;

  // Strategy 2: Try meta tags
  const metaPrice = extractMetaPrice($);
  if (metaPrice) return metaPrice;

  // Strategy 3: Try DOM selectors with priority ordering and scoring
  const priceCandidates: Array<{ price: string; score: number }> = [];

  const priceSelectors = [
    // Highest priority - sale/current prices (score: 100-90)
    { selector: '[class*="sale-price"]:not([class*="original"]):not([class*="was"]):not([class*="compare"])', score: 100 },
    { selector: '[class*="current-price"]:not([class*="original"]):not([class*="was"])', score: 98 },
    { selector: '[class*="final-price"]:not([class*="original"]):not([class*="was"])', score: 97 },
    { selector: '[class*="special-price"]:not([class*="original"]):not([class*="was"])', score: 96 },
    { selector: '[class*="offer-price"]:not([class*="original"]):not([class*="was"])', score: 95 },
    { selector: '[data-product-price]:not([data-price-type="original"])', score: 94 },
    { selector: '[data-sale-price]', score: 93 },
    { selector: '[data-price]:not([data-price-type="original"]):not([data-price-type="compare"])', score: 92 },
    { selector: '.price-now:not(.price-was)', score: 91 },
    { selector: '.sale:not(.sale-old)', score: 90 },

    // High priority - structured pricing (score: 89-80)
    { selector: '[itemprop="price"]:not([itemprop="highPrice"])', score: 89 },
    { selector: '[itemprop="lowPrice"]', score: 88 },
    { selector: 'meta[itemprop="price"]', score: 87 },
    { selector: '.product-price:not(.product-price-old):not(.product-price-was)', score: 85 },
    { selector: '[class*="product-price"]:not([class*="original"]):not([class*="was"]):not([class*="old"])', score: 84 },

    // Medium priority - general price selectors (score: 79-60)
    { selector: '.price:not(.price-was):not(.price-original):not(.price-old):not(.price-compare)', score: 75 },
    { selector: 'span[class*="price"]:not([class*="original"]):not([class*="was"]):not([class*="compare"]):not([class*="old"])', score: 70 },
    { selector: 'div[class*="price"]:not([class*="original"]):not([class*="was"]):not([class*="compare"])', score: 65 },
    { selector: '[data-test*="price"]:not([data-test*="original"])', score: 63 },
    { selector: '[aria-label*="price" i]:not([aria-label*="original" i])', score: 62 },

    // Lower priority - broad matchers (score: 59-40)
    { selector: '[class*="price"]', score: 50 },
    { selector: '.price', score: 45 },
    { selector: '[id*="price"]', score: 40 },
  ];

  for (const { selector, score } of priceSelectors) {
    const elements = $(selector);

    elements.each((_, elem) => {
      const $elem = $(elem);

      // Skip if element is hidden (display:none or visibility:hidden)
      const style = $elem.attr("style") || "";
      if (style.includes("display:none") || style.includes("visibility:hidden")) {
        return;
      }

      // Skip if element or its parent has strikethrough styling
      const hasStrikethrough = 
        style.includes("text-decoration:line-through") ||
        style.includes("text-decoration: line-through") ||
        $elem.parent().attr("style")?.includes("line-through");
      
      if (hasStrikethrough) return;

      // Skip if this is clearly an old/original price by class/id
      const className = ($elem.attr("class") || "").toLowerCase();
      const id = ($elem.attr("id") || "").toLowerCase();
      const dataAttrs = Object.keys($elem.attr() || {}).join(" ").toLowerCase();
      
      const isOldPrice = 
        className.includes("was") || className.includes("original") ||
        className.includes("compare") || className.includes("old") ||
        className.includes("strike") || className.includes("regular") ||
        id.includes("was") || id.includes("original") || id.includes("old") ||
        dataAttrs.includes("original") || dataAttrs.includes("compare");

      if (isOldPrice) return;

      // Extract price text from various sources
      let priceText =
        $elem.attr("content") ||
        $elem.attr("data-price") ||
        $elem.attr("data-product-price") ||
        $elem.attr("data-sale-price") ||
        $elem.attr("aria-label") ||
        $elem.text().trim();

      if (priceText) {
        const cleaned = cleanAndExtractPrice(priceText);
        if (cleaned) {
          // Boost score if element contains "sale" or "now"
          let adjustedScore = score;
          if (className.includes("sale") && !className.includes("old")) adjustedScore += 5;
          if (className.includes("now")) adjustedScore += 3;
          if (className.includes("current")) adjustedScore += 3;
          
          // Reduce score if element contains multiple prices (likely a range)
          const priceMatches = priceText.match(/\d+[.,]\d+/g) || [];
          if (priceMatches.length > 1) adjustedScore -= 20;

          priceCandidates.push({ price: cleaned, score: adjustedScore });
        }
      }
    });
  }

  // Sort candidates by score and return the best match
  if (priceCandidates.length > 0) {
    priceCandidates.sort((a, b) => b.score - a.score);
    return priceCandidates[0].price;
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
 * ENHANCED: Better handling of international formats, ranges, and sale prices
 */
function cleanAndExtractPrice(rawText: string): string | null {
  if (!rawText || rawText.length === 0) return null;

  // Remove extra whitespace and normalize
  let text = rawText.replace(/\s+/g, " ").trim();

  // Remove common non-price text patterns
  text = text.replace(/\b(from|starting at|as low as|only|sale|save|now)\b/gi, "");
  text = text.replace(/\b(per item|each|ea\.?)\b/gi, "");
  
  // Handle price ranges - extract the first (usually sale/current) price
  // Pattern: $99 - $149 → $99
  text = text.replace(/(\$\s*[\d,]+(?:\.\d{2})?)\s*[-–—]\s*\$\s*[\d,]+(?:\.\d{2})?/, "$1");
  text = text.replace(/(£\s*[\d,]+(?:\.\d{2})?)\s*[-–—]\s*£\s*[\d,]+(?:\.\d{2})?/, "$1");
  text = text.replace(/(€\s*[\d,]+(?:\.\d{2})?)\s*[-–—]\s*€\s*[\d,]+(?:\.\d{2})?/, "$1");

  // Comprehensive currency patterns (symbol or code)
  const currencyPatterns = [
    // Major currencies with symbols (prioritize these)
    { regex: /\$\s*[\d,]+(?:\.\d{1,2})?/, symbol: "$", priority: 10 },
    { regex: /£\s*[\d,]+(?:\.\d{1,2})?/, symbol: "£", priority: 10 },
    { regex: /€\s*[\d,]+(?:\.\d{1,2})?/, symbol: "€", priority: 10 },
    { regex: /¥\s*[\d,]+(?:\.\d{0,2})?/, symbol: "¥", priority: 9 },
    { regex: /₹\s*[\d,]+(?:\.\d{0,2})?/, symbol: "₹", priority: 9 },
    { regex: /₽\s*[\d,]+(?:\.\d{0,2})?/, symbol: "₽", priority: 8 },
    { regex: /R\$\s*[\d,]+(?:\.\d{1,2})?/, symbol: "R$", priority: 8 },
    { regex: /C\$\s*[\d,]+(?:\.\d{1,2})?/, symbol: "C$", priority: 8 },
    { regex: /A\$\s*[\d,]+(?:\.\d{1,2})?/, symbol: "A$", priority: 8 },
    { regex: /kr\.?\s*[\d,]+(?:\.\d{0,2})?/, symbol: "kr", priority: 7 },
    { regex: /CHF\s*[\d,]+(?:\.\d{1,2})?/, symbol: "CHF", priority: 7 },
    { regex: /zł\s*[\d,]+(?:\.\d{0,2})?/, symbol: "zł", priority: 7 },
    { regex: /₪\s*[\d,]+(?:\.\d{0,2})?/, symbol: "₪", priority: 7 },
    { regex: /฿\s*[\d,]+(?:\.\d{0,2})?/, symbol: "฿", priority: 7 },

    // Currency codes (3-letter ISO codes)
    { regex: /USD\s*[\d,]+(?:\.\d{1,2})?/i, symbol: "USD", priority: 9 },
    { regex: /EUR\s*[\d,]+(?:\.\d{1,2})?/i, symbol: "EUR", priority: 9 },
    { regex: /GBP\s*[\d,]+(?:\.\d{1,2})?/i, symbol: "GBP", priority: 9 },
    { regex: /CAD\s*[\d,]+(?:\.\d{1,2})?/i, symbol: "CAD", priority: 8 },
    { regex: /AUD\s*[\d,]+(?:\.\d{1,2})?/i, symbol: "AUD", priority: 8 },
    { regex: /JPY\s*[\d,]+(?:\.\d{0,2})?/i, symbol: "JPY", priority: 8 },
    { regex: /INR\s*[\d,]+(?:\.\d{0,2})?/i, symbol: "INR", priority: 8 },
    { regex: /CNY\s*[\d,]+(?:\.\d{0,2})?/i, symbol: "CNY", priority: 8 },
    { regex: /RUB\s*[\d,]+(?:\.\d{0,2})?/i, symbol: "RUB", priority: 7 },
    { regex: /BRL\s*[\d,]+(?:\.\d{1,2})?/i, symbol: "BRL", priority: 7 },
    { regex: /MXN\s*[\d,]+(?:\.\d{1,2})?/i, symbol: "MXN", priority: 7 },
    { regex: /NZD\s*[\d,]+(?:\.\d{1,2})?/i, symbol: "NZD", priority: 7 },
    { regex: /SGD\s*[\d,]+(?:\.\d{1,2})?/i, symbol: "SGD", priority: 7 },
    { regex: /HKD\s*[\d,]+(?:\.\d{1,2})?/i, symbol: "HKD", priority: 7 },
    { regex: /SEK\s*[\d,]+(?:\.\d{0,2})?/i, symbol: "SEK", priority: 7 },
    { regex: /NOK\s*[\d,]+(?:\.\d{0,2})?/i, symbol: "NOK", priority: 7 },
    { regex: /DKK\s*[\d,]+(?:\.\d{0,2})?/i, symbol: "DKK", priority: 7 },
    { regex: /PLN\s*[\d,]+(?:\.\d{0,2})?/i, symbol: "PLN", priority: 7 },
    { regex: /THB\s*[\d,]+(?:\.\d{0,2})?/i, symbol: "THB", priority: 7 },
    { regex: /ILS\s*[\d,]+(?:\.\d{0,2})?/i, symbol: "ILS", priority: 7 },

    // Reversed formats (number before currency) - common in Europe
    { regex: /[\d,]+(?:\.\d{1,2})?\s*USD/i, symbol: "USD", priority: 6 },
    { regex: /[\d,]+(?:\.\d{1,2})?\s*EUR/i, symbol: "EUR", priority: 6 },
    { regex: /[\d,]+(?:\.\d{1,2})?\s*GBP/i, symbol: "GBP", priority: 6 },
    { regex: /[\d,]+(?:\.\d{1,2})?\s*CAD/i, symbol: "CAD", priority: 5 },
    { regex: /[\d,]+(?:\.\d{1,2})?\s*AUD/i, symbol: "AUD", priority: 5 },
    { regex: /[\d,]+(?:\.\d{1,2})?\s*CHF/i, symbol: "CHF", priority: 5 },
    
    // European format with comma as decimal separator (e.g., "99,99 €")
    { regex: /[\d.]+,\d{1,2}\s*€/, symbol: "€", priority: 8 },
    { regex: /[\d.]+,\d{1,2}\s*kr/, symbol: "kr", priority: 7 },
    { regex: /[\d.]+,\d{1,2}\s*zł/, symbol: "zł", priority: 7 },
  ];

  // Sort patterns by priority and try to match
  currencyPatterns.sort((a, b) => b.priority - a.priority);

  for (const { regex, symbol } of currencyPatterns) {
    const match = text.match(regex);
    if (match) {
      let price = match[0].trim();
      
      // Normalize spacing
      price = price.replace(/\s+/g, " ");
      
      // Ensure currency is properly formatted
      if (symbol.length <= 2) {
        // Symbol-based currency - ensure proper positioning
        if (price.startsWith(symbol)) {
          price = price.replace(symbol, "").trim();
          price = `${symbol}${price}`;
        } else {
          price = `${symbol} ${price.replace(symbol, "").trim()}`;
        }
      }
      
      return price;
    }
  }

  // Fallback: Look for any number that looks like a price
  // Enhanced patterns to handle various international formats
  const numberPatterns = [
    { regex: /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})/, description: "Standard with thousands" }, // 1,234.56 or 1.234,56
    { regex: /\d{2,}(?:[.,]\d{2})/, description: "Simple with decimals" }, // 99.99 or 99,99
    { regex: /\d{2,}/, description: "Simple integer" }, // 99
  ];

  for (const { regex } of numberPatterns) {
    const match = text.match(regex);
    if (match) {
      const numberStr = match[0];
      
      // Try to parse and validate
      // Handle both comma and period as decimal separators
      let numValue: number;
      if (numberStr.includes(",") && numberStr.includes(".")) {
        // Both present - determine which is decimal separator
        const lastComma = numberStr.lastIndexOf(",");
        const lastPeriod = numberStr.lastIndexOf(".");
        if (lastComma > lastPeriod) {
          // Comma is decimal separator (European format)
          numValue = parseFloat(numberStr.replace(/\./g, "").replace(",", "."));
        } else {
          // Period is decimal separator (US format)
          numValue = parseFloat(numberStr.replace(/,/g, ""));
        }
      } else if (numberStr.includes(",")) {
        // Only comma - could be thousands or decimal separator
        const parts = numberStr.split(",");
        if (parts.length === 2 && parts[1].length === 2) {
          // Likely decimal separator (e.g., 99,99)
          numValue = parseFloat(numberStr.replace(",", "."));
        } else {
          // Likely thousands separator (e.g., 1,234 or 1,234,567)
          numValue = parseFloat(numberStr.replace(/,/g, ""));
        }
      } else {
        // No special characters or only period
        numValue = parseFloat(numberStr.replace(/,/g, ""));
      }
      
      // Validate it's a reasonable price
      if (!isNaN(numValue) && numValue >= 0.01 && numValue < 10000000) {
        return numberStr;
      }
    }
  }

  return null;
}

/**
 * Extract best product image with quality scoring
 * EXPORTED: Now available for web search enhancement
 */
export function extractBestProductImage(
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
 * ENHANCED: Detects modern e-commerce platforms, better scoring, and React/Vue app support
 */
export function extractProductsFromGrid(
  $: CheerioAPI,
  pageUrl: URL
): ProductCandidate[] {
  const products: ProductCandidate[] = [];
  const seen = new Set<string>();

  // Strategy 1: Find product containers with comprehensive selectors
  // Ordered by specificity and common e-commerce platforms
  const productContainerSelectors = [
    // Shopify-specific selectors (most common)
    '[class*="product-item"]',
    '[class*="product-card"]',
    '[data-product-id]',
    '.product-grid-item',
    '.grid__item[class*="product"]',
    
    // WooCommerce/WordPress
    '.product.type-product',
    'li.product',
    '.woocommerce-loop-product',
    
    // Magento
    '.product-item-info',
    '.product.item',
    
    // BigCommerce
    '.card[data-product-id]',
    'article.card',
    
    // Custom/Modern frameworks
    '[data-product]',
    '[data-testid*="product"]',
    '[data-test*="product"]',
    '[class*="product-grid-item"]',
    '[class*="collection-item"]',
    '[class*="grid-product"]',
    '[class*="product-tile"]',
    '[class*="product-box"]',
    '[class*="item-card"]',
    
    // Generic but effective
    'article[class*="product"]',
    'li[class*="product"]',
    'div[class*="product-wrapper"]',
    '.product',
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

      // Extract image with enhanced lazy-loading support
      let image = "";
      const $imgs = $container.find("img");
      
      // Try multiple images and score them
      const imageCandidates: Array<{ url: string; score: number }> = [];
      
      $imgs.each((_, imgElem) => {
        const $img = $(imgElem);
        
        // Try multiple attribute sources for lazy-loaded images
        const src =
          $img.attr("src") ||
          $img.attr("data-src") ||
          $img.attr("data-original") ||
          $img.attr("data-lazy") ||
          $img.attr("data-lazy-src") ||
          $img.attr("data-srcset")?.split(",")[0]?.split(" ")[0] ||
          $img.attr("data-image") ||
          $img.attr("srcset")?.split(",")[0]?.split(" ")[0];

        if (src && !src.includes("data:image")) {
          const resolved = resolveUrl(src, pageUrl);
          if (resolved && isValidImageUrl(resolved.toString())) {
            const url = resolved.toString();
            
            // Score based on image attributes and position
            let score = 50;
            const className = ($img.attr("class") || "").toLowerCase();
            const alt = ($img.attr("alt") || "").toLowerCase();
            
            // Boost score for primary product images
            if (className.includes("primary") || className.includes("main")) score += 20;
            if (className.includes("featured")) score += 15;
            if (alt.includes("product")) score += 10;
            
            // Boost for larger images
            const width = parseInt($img.attr("width") || "0");
            const height = parseInt($img.attr("height") || "0");
            if (width > 300 || height > 300) score += 15;
            if (width > 600 || height > 600) score += 5;
            
            // Reduce score for thumbnails
            if (className.includes("thumb") || className.includes("small")) score -= 20;
            if (width > 0 && width < 200) score -= 15;
            
            imageCandidates.push({ url, score });
          }
        }
      });
      
      // Select the best image candidate
      if (imageCandidates.length > 0) {
        imageCandidates.sort((a, b) => b.score - a.score);
        image = imageCandidates[0].url;
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
