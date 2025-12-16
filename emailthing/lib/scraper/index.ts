/**
 * PR2: Web Scraping & Brand Ingestion
 * Main scraper module
 */

import { load } from "cheerio";
import type { BrandContext } from "../types";
import { normalizeBrandContext } from "../normalize/brandContext";
import { newPage, closeBrowser, closePage } from "./browser";
import { loadHtml, withRetries } from "./fetch";
import { normalizeUrl, assertPublicHostname } from "./url";
import { ScraperError, isScraperError } from "./errors";
import { discoverLinks, selectTopCandidates } from "./discover";
import { extractBrandName } from "./extract/brandName";
import { extractLogoUrl } from "./extract/logo";
import { extractHeroImage } from "./extract/heroImage";
import { extractColors } from "./extract/colors";
import { extractFonts } from "./extract/fonts";
import { extractVoiceSnippets } from "./extract/voice";
import {
  extractProductsFromJsonLd,
  extractProductFromDom,
  extractProductsFromGrid,
  mergeAndDedupeProducts,
  type ProductCandidate,
} from "./extract/products";
import { enhanceProductsWithWebSearch } from "./webSearch";

/**
 * Scrape brand context from a website
 * This is the main entry point for PR2
 *
 * @param brandUrl - The brand's website URL
 * @returns Validated BrandContext object
 */
export async function scrapeBrand(brandUrl: string): Promise<BrandContext> {
  // Global timeout budget (10 seconds)
  const timeout = 10000;
  const startTime = Date.now();

  let page: any = null;

  try {
    // 1. Validate and sanitize URL
    const url = normalizeUrl(brandUrl);
    assertPublicHostname(url);

    // 2. Create a new browser page
    page = await newPage({ timeout: 8000 });

    // 3. Load homepage
    const { html: homepageHtml, finalUrl } = await withRetries(() =>
      loadHtml(page, url.toString(), { waitForNetworkIdle: true })
    );

    const homepageUrl = new URL(finalUrl);
    const $ = load(homepageHtml);

    // 4. Extract brand tokens
    const brandName = extractBrandName($, homepageUrl.hostname);
    const logoUrl = extractLogoUrl($, homepageUrl, brandName);
    const heroImage = extractHeroImage($, homepageUrl, brandName);
    const colors = await extractColors(page, $);
    const fonts = await extractFonts(page);
    const voice = extractVoiceSnippets($);

    // 5. Discover product and collection links
    const discovered = discoverLinks($, homepageUrl);
    const selected = selectTopCandidates({
      products: discovered.products,
      collections: discovered.collections,
      maxProducts: 4,
      maxCollections: 1,
    });

    // 6. Collect products from homepage
    const allProducts: ProductCandidate[] = [];

    // Try JSON-LD first
    const homepageJsonProducts = extractProductsFromJsonLd($, homepageUrl);
    allProducts.push(...homepageJsonProducts);

    // Also try grid extraction for homepage
    const homepageGridProducts = extractProductsFromGrid($, homepageUrl);
    allProducts.push(...homepageGridProducts);

    // 7. Optionally load collection page (if time permits)
    if (selected.collection && Date.now() - startTime < timeout - 3000) {
      try {
        const { html: collectionHtml } = await loadHtml(
          page,
          selected.collection,
          { timeout: 3000 }
        );
        const $collection = load(collectionHtml);

        // Extract products using multiple strategies
        const collectionJsonProducts = extractProductsFromJsonLd(
          $collection,
          new URL(selected.collection)
        );
        allProducts.push(...collectionJsonProducts);

        // Try grid extraction for collection page
        const collectionGridProducts = extractProductsFromGrid(
          $collection,
          new URL(selected.collection)
        );
        allProducts.push(...collectionGridProducts);

        // Update product links from collection
        const collectionLinks = discoverLinks(
          $collection,
          new URL(selected.collection)
        );
        selected.products.push(
          ...collectionLinks.products.slice(0, 6).map((c) => c.url)
        );
      } catch {
        // Ignore collection errors
      }
    }

    // 8. Load up to 4 product pages
    const productUrls = [...new Set(selected.products)].slice(0, 4);

    for (const productUrl of productUrls) {
      if (Date.now() - startTime >= timeout - 2000) break;

      try {
        const { html: productHtml } = await loadHtml(page, productUrl, {
          timeout: 2000,
        });
        const $product = load(productHtml);
        const productPageUrl = new URL(productUrl);

        // Try JSON-LD first, then DOM extraction
        const jsonLdProducts = extractProductsFromJsonLd(
          $product,
          productPageUrl
        );
        if (jsonLdProducts.length > 0) {
          allProducts.push(...jsonLdProducts);
        } else {
          const domProduct = extractProductFromDom($product, productPageUrl);
          if (domProduct) {
            allProducts.push(domProduct);
          }
        }
      } catch {
        // Ignore individual product page errors
      }
    }

    // 9. Merge and dedupe products, cap at 8
    let uniqueProducts = mergeAndDedupeProducts(allProducts).slice(0, 8);

    // 9.5. Enhance products with web search for missing images/prices
    // Check if any products need enhancement
    const needsEnhancement = uniqueProducts.some(
      (p) => !p.image || p.image === "" || !p.price || p.price === "N/A" || p.price === ""
    );

    if (needsEnhancement && page) {
      console.log("Some products missing images or prices, searching web...");
      try {
        const enhanced = await enhanceProductsWithWebSearch(
          page,
          uniqueProducts,
          brandName,
          6 // Max 6 searches to avoid timeout (3 seconds budget)
        );
        
        // Log enhancement results
        const enhancedCount = enhanced.filter(p => p.foundImage || p.foundPrice).length;
        if (enhancedCount > 0) {
          console.log(`Successfully enhanced ${enhancedCount} products via web search`);
        }
        
        uniqueProducts = enhanced;
      } catch (error) {
        console.warn("Web search enhancement failed, using original products:", error);
        // Continue with original products if enhancement fails
      }
    }

    // 9.6. If no hero image and no products with images, search for a brand image
    let finalHeroImage = heroImage;
    if (!finalHeroImage && uniqueProducts.length === 0 && page) {
      console.log("No hero image and no products, searching for brand image...");
      try {
        const { searchForBrandImage } = await import("./webSearch");
        const brandImage = await searchForBrandImage(page, brandName, homepageUrl.toString());
        
        if (brandImage) {
          console.log(`Found brand image via web search: ${brandImage}`);
          finalHeroImage = {
            url: brandImage,
            alt: `${brandName} brand image`,
          };
        }
      } catch (error) {
        console.warn("Brand image search failed:", error);
        // Continue without hero image
      }
    }

    // 10. Build BrandContext
    const brandContext: BrandContext = {
      brand: {
        name: brandName,
        website: homepageUrl.toString(),
        logoUrl: logoUrl,
        heroImage: finalHeroImage || undefined,
        colors: {
          primary: colors.primary,
          background: colors.background,
          text: colors.text,
        },
        fonts: {
          heading: fonts.heading,
          body: fonts.body,
        },
        voiceHints: voice.voiceHints,
        snippets: voice.snippets,
      },
      catalog: uniqueProducts.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        image: p.image,
        url: p.url,
      })),
      trust: {},
    };

    // 11. Normalize and validate
    const normalized = normalizeBrandContext(brandContext);

    // 12. Close page
    if (page) await page.close();

    return normalized;
  } catch (err) {
    // Close page on error
    if (page) {
      try {
        await page.close();
      } catch {
        // Ignore close errors
      }
    }

    // Log error for debugging (in production, use proper logger)
    if (isScraperError(err)) {
      console.error(`[ScraperError] ${err.code}: ${err.message}`);
    } else {
      console.error(`[ScraperError] Unexpected error:`, err);
    }

    // Return safe fallback BrandContext
    return createFallbackBrandContext(brandUrl);
  }
}

/**
 * Create a safe fallback BrandContext when scraping fails
 */
function createFallbackBrandContext(brandUrl: string): BrandContext {
  let hostname = "Unknown Brand";
  try {
    const url = new URL(
      brandUrl.startsWith("http") ? brandUrl : `https://${brandUrl}`
    );
    hostname = url.hostname.replace(/^www\./, "");
  } catch {
    // Ignore URL parse errors
  }

  const fallback: BrandContext = {
    brand: {
      name: hostname,
      website: brandUrl.startsWith("http") ? brandUrl : `https://${brandUrl}`,
      logoUrl: "",
      colors: {
        primary: "#111111",
        background: "#FFFFFF",
        text: "#111111",
      },
      fonts: {
        heading: "Arial, sans-serif",
        body: "Arial, sans-serif",
      },
      voiceHints: [],
      snippets: {},
    },
    catalog: [],
    trust: {},
  };

  return normalizeBrandContext(fallback);
}

/**
 * Export for cleanup in long-running processes
 */
export { closeBrowser, closePage };

/**
 * Re-export error types for consumers
 */
export { ScraperError, isScraperError } from "./errors";
export type { ScraperErrorCode } from "./errors";
