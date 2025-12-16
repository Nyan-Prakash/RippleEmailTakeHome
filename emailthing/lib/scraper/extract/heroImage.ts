import type { CheerioAPI } from "cheerio";
import { resolveUrl } from "../url";

/**
 * Extract hero image from HTML
 * Looks for large banner/hero images that would work well in email headers
 */
export function extractHeroImage(
  $: CheerioAPI,
  baseUrl: URL,
  brandName: string
): { url: string; alt: string } | null {
  const candidates: Array<{ url: string; alt: string; score: number }> = [];

  // 1. Check Open Graph image (often a good hero)
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) {
    const resolved = resolveUrl(ogImage, baseUrl);
    if (resolved && isLikelyHeroImage(ogImage)) {
      candidates.push({
        url: resolved.toString(),
        alt: `${brandName} hero image`,
        score: 80,
      });
    }
  }

  // 2. Find images with hero/banner indicators
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

    // High score for explicit "hero" or "banner" in class/id
    if (
      className.includes("hero") ||
      id.includes("hero") ||
      className.includes("banner") ||
      id.includes("banner")
    ) {
      score += 60;
    }

    // Check for hero/banner in src URL
    if (srcLower.includes("hero") || srcLower.includes("banner")) {
      score += 40;
    }

    // Check for "featured" or "main" indicators
    if (
      className.includes("featured") ||
      id.includes("featured") ||
      className.includes("main")
    ) {
      score += 30;
    }

    // Highly prefer images in hero/banner sections
    const inHero = $img.closest(
      "section.hero, .hero, .banner, .hero-section, .main-banner, [class*='hero'], [class*='banner']"
    ).length > 0;
    if (inHero) {
      score += 50;
    }

    // Prefer images near the top of the page
    const inHeader = $img.closest("header, .header, .site-header, .top-bar").length > 0;
    if (inHeader) {
      score += 25;
    }

    // Penalize if it looks like a logo (we want hero, not logo)
    if (
      className.includes("logo") ||
      id.includes("logo") ||
      srcLower.includes("logo")
    ) {
      score -= 70;
    }

    // Penalize small images (heroes should be large)
    const width = parseInt($img.attr("width") || "0", 10);
    const height = parseInt($img.attr("height") || "0", 10);
    if (width > 0 && width < 400) {
      score -= 30;
    }
    if (height > 0 && height < 200) {
      score -= 30;
    }

    // Prefer wide images (typical hero aspect ratio)
    if (width > 0 && height > 0 && width / height > 1.5) {
      score += 20;
    }

    // Penalize product images
    if (
      className.includes("product") ||
      srcLower.includes("product") ||
      className.includes("thumbnail")
    ) {
      score -= 40;
    }

    // Only consider images with positive scores
    if (score > 0) {
      const resolved = resolveUrl(src, baseUrl);
      if (resolved) {
        candidates.push({
          url: resolved.toString(),
          alt: alt || `${brandName} hero image`,
          score,
        });
      }
    }
  });

  // 3. Check for picture/source elements (often used for responsive heroes)
  $("picture").each((_, elem) => {
    const $picture = $(elem);
    const $img = $picture.find("img").first();
    const src = $img.attr("src") || $picture.find("source").first().attr("srcset")?.split(" ")[0];

    if (!src) return;

    const className = ($picture.attr("class") || "").toLowerCase();
    const id = ($picture.attr("id") || "").toLowerCase();

    let score = 40; // Base score for picture element

    if (className.includes("hero") || id.includes("hero") || className.includes("banner")) {
      score += 60;
    }

    const inHero = $picture.closest(
      "section.hero, .hero, .banner, .hero-section, [class*='hero'], [class*='banner']"
    ).length > 0;
    if (inHero) {
      score += 50;
    }

    if (score > 0) {
      const resolved = resolveUrl(src, baseUrl);
      if (resolved) {
        const alt = $img.attr("alt") || `${brandName} hero image`;
        candidates.push({
          url: resolved.toString(),
          alt,
          score,
        });
      }
    }
  });

  // Sort by score and return the best candidate
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);

  // Return the highest-scoring candidate that looks valid
  for (const candidate of candidates) {
    if (isValidImageUrl(candidate.url)) {
      return {
        url: candidate.url,
        alt: candidate.alt || `${brandName} hero image`,
      };
    }
  }

  return null;
}

/**
 * Check if URL looks like a hero image
 */
function isLikelyHeroImage(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    (lower.includes("hero") ||
      lower.includes("banner") ||
      lower.includes("featured")) &&
    !lower.includes("logo") &&
    !lower.includes("icon") &&
    !lower.includes("thumb")
  );
}

/**
 * Validate image URL
 */
function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    return (
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".png") ||
      path.endsWith(".webp") ||
      path.endsWith(".gif") ||
      path.includes("/image") ||
      path.includes("/img") ||
      urlObj.hostname.includes("cdn") ||
      urlObj.hostname.includes("cloudinary") ||
      urlObj.hostname.includes("imgix")
    );
  } catch {
    return false;
  }
}
