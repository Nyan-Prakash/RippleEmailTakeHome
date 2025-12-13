import type { CheerioAPI } from "cheerio";
import type { Page } from "playwright";

/**
 * Extracted color palette
 */
export interface ColorPalette {
  primary: string;
  background: string;
  text: string;
}

/**
 * Extract brand colors from page
 * Enhanced with multiple detection strategies
 */
export async function extractColors(
  page: Page,
  $: CheerioAPI
): Promise<ColorPalette> {
  const defaults: ColorPalette = {
    primary: "#111111",
    background: "#FFFFFF",
    text: "#111111",
  };

  try {
    // Extract CSS variable definitions
    const cssVars = extractCssVariables($);

    // Extract colors from meta tags
    const metaColors = extractMetaColors($);

    // Extract computed styles for prominent elements
    const computed = await extractComputedColors(page);

    // Extract colors from prominent CTAs and links
    const ctaColors = await extractCTAColors(page);

    // Analyze all images for dominant colors
    const imageColors = await extractDominantColorsFromImages(page);

    // Combine and select best candidates with prioritization
    const primaryCandidates = [
      cssVars.primary,
      metaColors.themeColor,
      cssVars.accent,
      ctaColors.primaryCTA,
      imageColors.dominant,
      computed.buttonBg,
      computed.linkColor,
    ];

    const primary = selectPrimaryColor(primaryCandidates) || defaults.primary;

    const background =
      normalizeColor(cssVars.background || "") ||
      normalizeColor(computed.bodyBg || "") ||
      defaults.background;

    const text =
      normalizeColor(cssVars.text || "") ||
      normalizeColor(computed.bodyText || "") ||
      defaults.text;

    return {
      primary: normalizeColor(primary),
      background,
      text,
    };
  } catch {
    return defaults;
  }
}

/**
 * Extract CSS variable definitions from style tags
 */
function extractCssVariables($: CheerioAPI): {
  primary?: string;
  accent?: string;
  background?: string;
  text?: string;
} {
  const vars: { primary?: string; accent?: string; background?: string; text?: string } = {};

  $("style").each((_, elem) => {
    const css = $(elem).html() || "";

    // Look for :root or html variable definitions
    const rootMatch = css.match(/:root\s*\{([^}]+)\}/);
    if (rootMatch) {
      const declarations = rootMatch[1];

      // Extract --primary, --accent, --primary-color, etc.
      const primaryPatterns = [
        /--(?:primary|brand|main)(?:-color)?:\s*([^;]+);/i,
        /--color-primary:\s*([^;]+);/i,
        /--brand-color:\s*([^;]+);/i,
      ];
      for (const pattern of primaryPatterns) {
        const match = declarations.match(pattern);
        if (match) {
          vars.primary = match[1].trim();
          break;
        }
      }

      // Extract accent
      const accentMatch = declarations.match(
        /--(?:accent|secondary)(?:-color)?:\s*([^;]+);/i
      );
      if (accentMatch) {
        vars.accent = accentMatch[1].trim();
      }

      // Extract background
      const bgMatch = declarations.match(
        /--(?:background|bg)(?:-color)?:\s*([^;]+);/i
      );
      if (bgMatch) {
        vars.background = bgMatch[1].trim();
      }

      // Extract text
      const textMatch = declarations.match(
        /--(?:text|foreground|fg)(?:-color)?:\s*([^;]+);/i
      );
      if (textMatch) {
        vars.text = textMatch[1].trim();
      }
    }
  });

  return vars;
}

/**
 * Extract colors from meta tags
 */
function extractMetaColors($: CheerioAPI): {
  themeColor?: string;
} {
  const themeColor = $('meta[name="theme-color"]').attr("content") ||
                      $('meta[name="msapplication-TileColor"]').attr("content");

  return {
    themeColor: themeColor || undefined,
  };
}

/**
 * Extract computed colors from page elements
 */
async function extractComputedColors(page: Page): Promise<{
  bodyBg?: string;
  bodyText?: string;
  buttonBg?: string;
  linkColor?: string;
}> {
  try {
    const colors = await page.evaluate(() => {
      const body = document.body;
      const bodyStyles = window.getComputedStyle(body);

      // Find a prominent button or CTA with multiple selectors
      const buttonSelectors = [
        'button[class*="primary"]',
        'a[class*="primary"]',
        'button[class*="cta"]',
        'a[class*="cta"]',
        '.btn-primary',
        '.button-primary',
        'button',
        'a[class*="button"]',
        'a[class*="btn"]',
      ];

      let button: Element | null = null;
      for (const selector of buttonSelectors) {
        button = document.querySelector(selector);
        if (button) break;
      }

      const buttonStyles = button ? window.getComputedStyle(button) : null;

      // Find links for brand color
      const link = document.querySelector('a[href]');
      const linkStyles = link ? window.getComputedStyle(link) : null;

      return {
        bodyBg: bodyStyles.backgroundColor,
        bodyText: bodyStyles.color,
        buttonBg: buttonStyles?.backgroundColor,
        linkColor: linkStyles?.color,
      };
    });

    return colors;
  } catch {
    return {};
  }
}

/**
 * Extract colors from CTA elements
 */
async function extractCTAColors(page: Page): Promise<{
  primaryCTA?: string;
}> {
  try {
    const ctaColor = await page.evaluate(() => {
      // Find CTAs with various selectors
      const ctaSelectors = [
        '[class*="add-to-cart"]',
        '[class*="buy-now"]',
        '[class*="shop-now"]',
        '[class*="cta"]',
        'button[class*="primary"]',
        '.btn-primary',
        '.button-primary',
      ];

      for (const selector of ctaSelectors) {
        const elem = document.querySelector(selector);
        if (elem) {
          const styles = window.getComputedStyle(elem);
          return styles.backgroundColor;
        }
      }

      return undefined;
    });

    return {
      primaryCTA: ctaColor,
    };
  } catch {
    return {};
  }
}

/**
 * Extract dominant colors from visible images (like logos, headers)
 */
async function extractDominantColorsFromImages(page: Page): Promise<{
  dominant?: string;
}> {
  try {
    const imageColor = await page.evaluate(() => {
      // This is a simplified approach - in production, you'd use canvas analysis
      // For now, we'll check background colors of header/hero sections
      const heroSelectors = [
        'header',
        '.hero',
        '.header',
        '[class*="hero"]',
        '.banner',
      ];

      for (const selector of heroSelectors) {
        const elem = document.querySelector(selector);
        if (elem) {
          const styles = window.getComputedStyle(elem);
          const bgColor = styles.backgroundColor;

          // Check if it's not transparent or white
          if (bgColor && !bgColor.includes('rgba(0, 0, 0, 0)') && bgColor !== 'transparent') {
            return bgColor;
          }
        }
      }

      return undefined;
    });

    return {
      dominant: imageColor,
    };
  } catch {
    return {};
  }
}

/**
 * Select the best primary color from candidates
 * Filters out near-white and near-black colors
 */
function selectPrimaryColor(candidates: (string | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;

    const normalized = normalizeColor(candidate);
    if (!normalized) continue;

    // Check if color is not too close to white or black
    if (!isNearWhite(normalized) && !isNearBlack(normalized)) {
      return normalized;
    }
  }

  return null;
}

/**
 * Normalize color to hex format
 */
function normalizeColor(color: string): string {
  color = color.trim();

  // Already hex
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color.toUpperCase();
  }

  // 3-digit hex
  if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = color.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/
  );
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // Fallback
  return color;
}

/**
 * Convert number to 2-digit hex
 */
function toHex(n: number): string {
  const clamped = Math.max(0, Math.min(255, n));
  return clamped.toString(16).padStart(2, "0").toUpperCase();
}

/**
 * Check if color is near white
 */
function isNearWhite(hex: string): boolean {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return false;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Consider "near white" if all channels > 240
  return r > 240 && g > 240 && b > 240;
}

/**
 * Check if color is near black
 */
function isNearBlack(hex: string): boolean {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return false;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Consider "near black" if all channels < 40
  return r < 40 && g < 40 && b < 40;
}
