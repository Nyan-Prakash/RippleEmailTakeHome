import type { CheerioAPI } from "cheerio";
import { resolveUrl } from "../url";

/**
 * Extract logo URL from HTML
 * Heuristics:
 * 1. <img> in header with class/id containing "logo"
 * 2. <img> with alt text matching brand name
 * 3. SVG with aria-label or title
 * 4. Favicon as fallback
 */
export function extractLogoUrl(
  $: CheerioAPI,
  baseUrl: URL,
  brandName: string
): string {
  const candidates: Array<{ url: string; score: number }> = [];

  // Find images with "logo" in class/id
  $("img").each((_, elem) => {
    const $img = $(elem);
    const src = $img.attr("src") || $img.attr("data-src");
    if (!src) return;

    const className = $img.attr("class") || "";
    const id = $img.attr("id") || "";
    const alt = $img.attr("alt") || "";

    let score = 0;

    // High score for "logo" in class/id
    if (
      className.toLowerCase().includes("logo") ||
      id.toLowerCase().includes("logo")
    ) {
      score += 10;
    }

    // Medium score for brand name in alt
    if (
      brandName &&
      alt.toLowerCase().includes(brandName.toLowerCase().split(" ")[0])
    ) {
      score += 5;
    }

    // Prefer images in header
    const inHeader = $img.closest("header, nav, .header, .navbar").length > 0;
    if (inHeader) {
      score += 3;
    }

    if (score > 0) {
      const resolved = resolveUrl(src, baseUrl);
      if (resolved) {
        candidates.push({ url: resolved.toString(), score });
      }
    }
  });

  // Check for SVG logos
  $("svg").each((_, elem) => {
    const $svg = $(elem);
    const ariaLabel = $svg.attr("aria-label") || "";
    const className = $svg.attr("class") || "";
    const id = $svg.attr("id") || "";

    if (
      ariaLabel.toLowerCase().includes("logo") ||
      className.toLowerCase().includes("logo") ||
      id.toLowerCase().includes("logo")
    ) {
      // SVGs are harder to extract as URLs, but note their presence
      // We'll prioritize image candidates instead
    }
  });

  // Sort by score and return top candidate
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].url;
  }

  // Fallback to favicon
  const favicon =
    $('link[rel="icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    $('link[rel="apple-touch-icon"]').attr("href");

  if (favicon) {
    const resolved = resolveUrl(favicon, baseUrl);
    if (resolved) {
      return resolved.toString();
    }
  }

  return "";
}
