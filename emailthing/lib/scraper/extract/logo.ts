import type { CheerioAPI } from "cheerio";
import { resolveUrl } from "../url";

/**
 * Extract logo URL from HTML
 * Enhanced with comprehensive detection strategies
 */
export function extractLogoUrl(
  $: CheerioAPI,
  baseUrl: URL,
  brandName: string
): string {
  const candidates: Array<{ url: string; score: number }> = [];

  // 1. Check structured data (Schema.org) - highest priority
  const schemaLogo = extractSchemaLogo($, baseUrl);
  if (schemaLogo) {
    candidates.push({ url: schemaLogo, score: 100 });
  }

  // 2. Check Open Graph image (often brand logo)
  const ogLogo = $('meta[property="og:logo"]').attr("content") ||
                  $('meta[property="og:image"]').attr("content");
  if (ogLogo) {
    const resolved = resolveUrl(ogLogo, baseUrl);
    if (resolved && isLikelyLogo(ogLogo)) {
      candidates.push({ url: resolved.toString(), score: 90 });
    }
  }

  // 3. Find images with comprehensive logo detection
  $("img").each((_, elem) => {
    const $img = $(elem);
    const src =
      $img.attr("src") ||
      $img.attr("data-src") ||
      $img.attr("data-lazy") ||
      $img.attr("data-original");

    if (!src) return;

    const className = ($img.attr("class") || "").toLowerCase();
    const id = ($img.attr("id") || "").toLowerCase();
    const alt = ($img.attr("alt") || "").toLowerCase();
    const srcLower = src.toLowerCase();

    let score = 0;

    // Very high score for explicit "logo" in class/id
    if (className.includes("logo") || id.includes("logo")) {
      score += 50;
    }

    // Check for logo in src URL
    if (srcLower.includes("logo")) {
      score += 30;
    }

    // Check for brand-related patterns
    if (className.includes("brand") || id.includes("brand")) {
      score += 25;
    }

    // Check alt text for brand name or "logo"
    if (alt.includes("logo")) {
      score += 20;
    }

    if (brandName) {
      const brandWords = brandName.toLowerCase().split(" ");
      for (const word of brandWords) {
        if (word.length > 2 && alt.includes(word)) {
          score += 15;
          break;
        }
      }
    }

    // Highly prefer images in header/nav
    const inHeader = $img.closest("header, nav, [role='banner'], .header, .navbar, .site-header, .top-bar").length > 0;
    if (inHeader) {
      score += 40;
    }

    // Prefer images with logo-like positioning
    const inLogo = $img.closest(".logo, .brand, .site-logo, .header-logo, [class*='logo']").length > 0;
    if (inLogo) {
      score += 35;
    }

    // Check if image has reasonable logo dimensions via class hints
    if (className.match(/\b(small|medium|large|full)\b/) && !className.includes("banner") && !className.includes("hero")) {
      score += 5;
    }

    // Penalize if it looks like a product/banner/hero image
    if (className.includes("product") || className.includes("banner") ||
        className.includes("hero") || className.includes("slide") ||
        srcLower.includes("banner") || srcLower.includes("hero")) {
      score -= 30;
    }

    // Penalize very large images (likely not logos)
    if (srcLower.match(/\b(1920|2000|3000|4000|1080p|2k|4k)\b/)) {
      score -= 20;
    }

    if (score > 0) {
      const resolved = resolveUrl(src, baseUrl);
      if (resolved) {
        const url = resolved.toString();
        // Avoid duplicates
        if (!candidates.find(c => c.url === url)) {
          candidates.push({ url, score });
        }
      }
    }
  });

  // 4. Check for link to homepage with logo image
  $("a[href]").each((_, elem) => {
    const $link = $(elem);
    const href = $link.attr("href") || "";

    // Check if link goes to homepage
    if (href === "/" || href === baseUrl.origin || href === baseUrl.toString()) {
      const $img = $link.find("img").first();
      if ($img.length) {
        const src = $img.attr("src") || $img.attr("data-src");
        if (src) {
          const resolved = resolveUrl(src, baseUrl);
          if (resolved) {
            const url = resolved.toString();
            if (!candidates.find(c => c.url === url)) {
              candidates.push({ url, score: 60 });
            } else {
              // Boost existing candidate
              const existing = candidates.find(c => c.url === url);
              if (existing) existing.score += 20;
            }
          }
        }
      }
    }
  });

  // 5. Check for SVG logos (convert to data URI or find linked version)
  $("svg").each((_, elem) => {
    const $svg = $(elem);
    const className = ($svg.attr("class") || "").toLowerCase();
    const id = ($svg.attr("id") || "").toLowerCase();
    const ariaLabel = ($svg.attr("aria-label") || "").toLowerCase();

    if (className.includes("logo") || id.includes("logo") || ariaLabel.includes("logo")) {
      // Check if SVG has an associated image fallback
      const $parent = $svg.parent();
      const bgImage = $parent.css("background-image");
      if (bgImage && bgImage.includes("url(")) {
        const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (urlMatch) {
          const resolved = resolveUrl(urlMatch[1], baseUrl);
          if (resolved) {
            candidates.push({ url: resolved.toString(), score: 45 });
          }
        }
      }
    }
  });

  // Sort by score and return top candidate with validation
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);

    // Validate top candidates
    for (const candidate of candidates) {
      if (isValidLogoUrl(candidate.url)) {
        return candidate.url;
      }
    }
  }

  // Fallback to high-quality favicon
  const favicon = extractFavicon($, baseUrl);
  if (favicon) {
    return favicon;
  }

  return "";
}

/**
 * Extract logo from Schema.org structured data
 */
function extractSchemaLogo($: CheerioAPI, baseUrl: URL): string | null {
  let foundLogo: string | null = null;

  $('script[type="application/ld+json"]').each((_, elem) => {
    if (foundLogo) return; // Early exit if we found a logo

    try {
      const json = JSON.parse($(elem).html() || "{}");
      const items = Array.isArray(json) ? json : [json];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;

        // Check for Organization or WebSite schema
        if ((item["@type"] === "Organization" || item["@type"] === "WebSite") && item.logo) {
          let logo: string | null = null;

          if (typeof item.logo === "string") {
            logo = item.logo;
          } else if (item.logo.url) {
            logo = item.logo.url;
          } else if (item.logo["@id"]) {
            logo = item.logo["@id"];
          }

          if (logo) {
            const resolved = resolveUrl(logo, baseUrl);
            if (resolved) {
              foundLogo = resolved.toString();
              return;
            }
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  });

  return foundLogo;
}

/**
 * Extract best favicon
 */
function extractFavicon($: CheerioAPI, baseUrl: URL): string | null {
  const faviconSelectors = [
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
    'link[rel="icon"][sizes="192x192"]',
    'link[rel="icon"][sizes="180x180"]',
    'link[rel="icon"][type="image/png"]',
    'link[rel="shortcut icon"]',
    'link[rel="icon"]',
  ];

  for (const selector of faviconSelectors) {
    const href = $(selector).attr("href");
    if (href) {
      const resolved = resolveUrl(href, baseUrl);
      if (resolved) {
        return resolved.toString();
      }
    }
  }

  // Try default favicon location
  const defaultFavicon = new URL("/favicon.ico", baseUrl);
  return defaultFavicon.toString();
}

/**
 * Check if URL is likely a logo
 */
function isLikelyLogo(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.includes("logo") ||
         urlLower.includes("brand") ||
         urlLower.includes("favicon");
}

/**
 * Validate logo URL quality
 */
function isValidLogoUrl(url: string): boolean {
  if (!url || url.length < 10) return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;

  const urlLower = url.toLowerCase();

  // Exclude non-logo patterns
  if (urlLower.includes("product")) return false;
  if (urlLower.includes("banner")) return false;
  if (urlLower.includes("hero")) return false;
  if (urlLower.includes("slide")) return false;
  if (urlLower.includes("thumbnail")) return false;

  return true;
}
