import type { CheerioAPI } from "cheerio";

/**
 * Extract brand name from HTML
 * Priority:
 * 1. og:site_name meta tag
 * 2. <title> tag (cleaned)
 * 3. Fallback from URL hostname
 */
export function extractBrandName(
  $: CheerioAPI,
  fallbackFromUrlHost: string
): string {
  // Try og:site_name first
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");
  if (ogSiteName && ogSiteName.trim().length > 0) {
    return ogSiteName.trim();
  }

  // Try title tag
  const title = $("title").text().trim();
  if (title.length > 0) {
    // Clean up title - remove common suffixes
    const cleaned = title
      .replace(/\s*[-|–—]\s*(Home|Shop|Store|Official|Online).*$/i, "")
      .trim();
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  // Fallback to hostname
  return fallbackFromUrlHost
    .replace(/^www\./, "")
    .replace(/\.[^.]+$/, "")
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
