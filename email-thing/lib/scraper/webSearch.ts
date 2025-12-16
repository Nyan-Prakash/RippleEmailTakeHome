/**
 * Web search enhancement for missing product data
 * Searches the web to find images and prices for products that are missing them
 */

import type { Page } from "./browser";
import { load } from "cheerio";
import { extractPrice, extractBestProductImage } from "./extract/products";
import type { ProductCandidate } from "./extract/products";

/**
 * Search result from web search
 */
interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

/**
 * Enhanced product with found data
 */
export interface EnhancedProduct extends ProductCandidate {
  foundImage?: boolean;
  foundPrice?: boolean;
  searchSource?: string;
}

/**
 * Search the web for a product using DuckDuckGo HTML search
 * This is a privacy-friendly, API-free approach
 */
async function searchWeb(
  page: Page,
  query: string,
  maxResults: number = 5
): Promise<SearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    await page.goto(searchUrl, { 
      waitUntil: "domcontentloaded",
      timeout: 5000 
    });

    const html = await page.content();
    const $ = load(html);

    const results: SearchResult[] = [];

    // DuckDuckGo HTML format: results are in .result class
    $(".result").each((i, elem) => {
      if (i >= maxResults) return false;

      const $result = $(elem);
      const $link = $result.find(".result__a");
      const $snippet = $result.find(".result__snippet");

      const url = $link.attr("href");
      const title = $link.text().trim();
      const snippet = $snippet.text().trim();

      if (url && title) {
        // DuckDuckGo uses redirect URLs, extract actual URL
        let actualUrl = url;
        try {
          const urlObj = new URL(url, "https://duckduckgo.com");
          const uddgParam = urlObj.searchParams.get("uddg");
          if (uddgParam) {
            actualUrl = decodeURIComponent(uddgParam);
          }
        } catch {
          // Keep original URL if parsing fails
        }

        results.push({ url: actualUrl, title, snippet });
      }
    });

    return results;
  } catch (error) {
    console.error("Web search failed:", error);
    return [];
  }
}

/**
 * Try to extract product image from a web page
 */
async function extractImageFromUrl(
  page: Page,
  url: string,
  pageUrl: URL
): Promise<string | null> {
  try {
    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 5000 
    });

    const html = await page.content();
    const $ = load(html);

    const image = extractBestProductImage($, pageUrl);
    return image || null;
  } catch (error) {
    console.error(`Failed to extract image from ${url}:`, error);
    return null;
  }
}

/**
 * Try to extract product price from a web page
 */
async function extractPriceFromUrl(
  page: Page,
  url: string
): Promise<string | null> {
  try {
    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 5000 
    });

    const html = await page.content();
    const $ = load(html);

    const price = extractPrice($);
    return price && price !== "N/A" ? price : null;
  } catch (error) {
    console.error(`Failed to extract price from ${url}:`, error);
    return null;
  }
}

/**
 * Search the web for a product image
 */
async function searchForProductImage(
  page: Page,
  productTitle: string,
  brandName: string
): Promise<string | null> {
  // Build search query with brand name for better results
  const searchQuery = `${brandName} ${productTitle} product image`;
  
  console.log(`Searching web for image: ${searchQuery}`);
  
  const results = await searchWeb(page, searchQuery, 5);
  
  // Try each result to find a product image
  for (const result of results) {
    // Skip non-ecommerce URLs (social media, videos, etc.)
    if (
      result.url.includes("youtube.com") ||
      result.url.includes("facebook.com") ||
      result.url.includes("twitter.com") ||
      result.url.includes("instagram.com") ||
      result.url.includes("pinterest.com")
    ) {
      continue;
    }

    try {
      const pageUrl = new URL(result.url);
      const image = await extractImageFromUrl(page, result.url, pageUrl);
      
      if (image) {
        console.log(`Found image for "${productTitle}" at ${result.url}`);
        return image;
      }
    } catch {
      // Try next result
      continue;
    }
  }

  return null;
}

/**
 * Search the web for a product price
 */
async function searchForProductPrice(
  page: Page,
  productTitle: string,
  brandName: string
): Promise<string | null> {
  // Build search query with price-focused terms
  const searchQuery = `${brandName} ${productTitle} price buy`;
  
  console.log(`Searching web for price: ${searchQuery}`);
  
  const results = await searchWeb(page, searchQuery, 5);
  
  // Try each result to find a product price
  for (const result of results) {
    // Skip non-ecommerce URLs
    if (
      result.url.includes("youtube.com") ||
      result.url.includes("facebook.com") ||
      result.url.includes("twitter.com") ||
      result.url.includes("instagram.com") ||
      result.url.includes("pinterest.com")
    ) {
      continue;
    }

    // Prioritize ecommerce sites
    const isEcommerceSite = 
      result.url.includes("amazon.") ||
      result.url.includes("ebay.") ||
      result.url.includes("walmart.") ||
      result.url.includes("target.") ||
      result.url.includes("shopify.") ||
      result.snippet.toLowerCase().includes("price") ||
      result.snippet.toLowerCase().includes("$");

    if (!isEcommerceSite) continue;

    try {
      const price = await extractPriceFromUrl(page, result.url);
      
      if (price) {
        console.log(`Found price for "${productTitle}": ${price} at ${result.url}`);
        return price;
      }
    } catch {
      // Try next result
      continue;
    }
  }

  return null;
}

/**
 * Enhance products by searching the web for missing images and prices
 * This function takes products with missing data and attempts to find them online
 * 
 * @param page - Playwright page instance for web navigation
 * @param products - Array of products that may have missing images or prices
 * @param brandName - Brand name to help focus search results
 * @param maxSearches - Maximum number of web searches to perform (to avoid timeout)
 * @returns Enhanced products with found images and prices
 */
export async function enhanceProductsWithWebSearch(
  page: Page,
  products: ProductCandidate[],
  brandName: string,
  maxSearches: number = 6
): Promise<EnhancedProduct[]> {
  const enhanced: EnhancedProduct[] = [];
  let searchCount = 0;

  for (const product of products) {
    // Stop if we've reached max searches
    if (searchCount >= maxSearches) {
      console.log(`Reached max searches (${maxSearches}), using products as-is`);
      enhanced.push({
        ...product,
        foundImage: false,
        foundPrice: false,
      });
      continue;
    }

    const needsImage = !product.image || product.image === "";
    const needsPrice = !product.price || product.price === "N/A" || product.price === "";

    // If product has both image and price, no search needed
    if (!needsImage && !needsPrice) {
      enhanced.push({
        ...product,
        foundImage: false,
        foundPrice: false,
      });
      continue;
    }

    console.log(`Product "${product.title}" missing:`, {
      image: needsImage,
      price: needsPrice,
    });

    let foundImage = product.image;
    let foundPrice = product.price;
    let didSearchImage = false;
    let didSearchPrice = false;
    let searchSource = "";

    // Search for image if missing
    if (needsImage && searchCount < maxSearches) {
      const image = await searchForProductImage(page, product.title, brandName);
      if (image) {
        foundImage = image;
        didSearchImage = true;
        searchSource = "web search";
      }
      searchCount++;
    }

    // Search for price if missing
    if (needsPrice && searchCount < maxSearches) {
      const price = await searchForProductPrice(page, product.title, brandName);
      if (price) {
        foundPrice = price;
        didSearchPrice = true;
        searchSource = searchSource ? `${searchSource} + web search` : "web search";
      }
      searchCount++;
    }

    enhanced.push({
      ...product,
      image: foundImage,
      price: foundPrice,
      foundImage: didSearchImage,
      foundPrice: didSearchPrice,
      searchSource: searchSource || undefined,
    });
  }

  return enhanced;
}

/**
 * Search for a brand image (not logo) to use as hero image
 * Searches for general brand imagery like storefronts, products, or lifestyle shots
 * 
 * @param page - Playwright page instance
 * @param brandName - Name of the brand
 * @param brandWebsite - Brand's website URL for context
 * @returns URL of found brand image or null
 */
export async function searchForBrandImage(
  page: Page,
  brandName: string,
  brandWebsite: string
): Promise<string | null> {
  console.log(`Searching for brand image for "${brandName}"...`);

  // Search for brand images (excluding logos)
  const searchQuery = `${brandName} store products lifestyle -logo`;
  const results = await searchWeb(page, searchQuery, 8);

  // Filter and prioritize results
  for (const result of results) {
    // Skip social media and video sites
    if (
      result.url.includes("youtube.com") ||
      result.url.includes("facebook.com") ||
      result.url.includes("twitter.com") ||
      result.url.includes("instagram.com") ||
      result.url.includes("tiktok.com")
    ) {
      continue;
    }

    // Prioritize brand's own website or trusted sources
    const isBrandSite = result.url.includes(brandWebsite.replace(/^https?:\/\/(www\.)?/, ""));
    const isTrustedSource = 
      result.url.includes("shopify.") ||
      result.url.includes("about.") ||
      result.url.includes("/about") ||
      result.snippet.toLowerCase().includes("official");

    // Skip if not brand site or trusted source
    if (!isBrandSite && !isTrustedSource) continue;

    try {
      // Load the page and extract the best image
      await page.goto(result.url, { 
        waitUntil: "domcontentloaded",
        timeout: 3000 
      });

      const html = await page.content();
      const $ = load(html);

      // Look for hero images, banners, or large product images
      const heroSelectors = [
        'header img[src*="hero"]',
        'section img[src*="banner"]',
        '.hero img',
        '.banner img',
        '[class*="hero"] img',
        '[class*="banner"] img',
        'img[src*="slider"]',
        'img[width][height]' // Large images with dimensions
      ];

      let bestImage: string | null = null;
      let maxSize = 0;

      for (const selector of heroSelectors) {
        $(selector).each((_, elem) => {
          const src = $(elem).attr("src");
          if (!src) return;

          // Skip logos, icons, and small images
          if (
            src.includes("logo") ||
            src.includes("icon") ||
            src.includes("favicon") ||
            src.endsWith(".svg")
          ) {
            return;
          }

          // Get image dimensions if available
          const width = parseInt($(elem).attr("width") || "0");
          const height = parseInt($(elem).attr("height") || "0");
          const size = width * height;

          // Look for larger images (at least 500x300)
          if (size > maxSize && width >= 500 && height >= 300) {
            maxSize = size;
            // Convert relative URLs to absolute
            try {
              const imageUrl = new URL(src, result.url);
              bestImage = imageUrl.toString();
            } catch {
              // Skip invalid URLs
            }
          }
        });
      }

      // If we found a good image from brand's site, use it
      if (bestImage && isBrandSite) {
        console.log(`Found brand image at ${result.url}: ${bestImage}`);
        return bestImage;
      }

      // For non-brand sites, be more selective
      if (bestImage && maxSize > 500 * 400) {
        console.log(`Found brand image at ${result.url}: ${bestImage}`);
        return bestImage;
      }
    } catch (error) {
      // Try next result
      console.log(`Failed to extract image from ${result.url}:`, error);
      continue;
    }
  }

  console.log(`No suitable brand image found for "${brandName}"`);
  return null;
}
