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
 * Uses CSS variables and computed styles
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

    // Extract computed styles for prominent elements
    const computed = await extractComputedColors(page);

    // Combine and select best candidates
    const primary =
      selectPrimaryColor([
        cssVars.primary,
        cssVars.accent,
        computed.buttonBg,
      ]) || defaults.primary;

    const background = computed.bodyBg || defaults.background;
    const text = computed.bodyText || defaults.text;

    return {
      primary: normalizeColor(primary),
      background: normalizeColor(background),
      text: normalizeColor(text),
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
} {
  const vars: { primary?: string; accent?: string } = {};

  $("style").each((_, elem) => {
    const css = $(elem).html() || "";

    // Look for :root or html variable definitions
    const rootMatch = css.match(/:root\s*\{([^}]+)\}/);
    if (rootMatch) {
      const declarations = rootMatch[1];

      // Extract --primary, --accent, --primary-color, etc.
      const primaryMatch = declarations.match(
        /--(?:primary|brand|accent)(?:-color)?:\s*([^;]+);/i
      );
      if (primaryMatch) {
        vars.primary = primaryMatch[1].trim();
      }

      const accentMatch = declarations.match(
        /--accent(?:-color)?:\s*([^;]+);/i
      );
      if (accentMatch) {
        vars.accent = accentMatch[1].trim();
      }
    }
  });

  return vars;
}

/**
 * Extract computed colors from page elements
 */
async function extractComputedColors(page: Page): Promise<{
  bodyBg?: string;
  bodyText?: string;
  buttonBg?: string;
}> {
  try {
    const colors = await page.evaluate(() => {
      const body = document.body;
      const bodyStyles = window.getComputedStyle(body);

      // Find a prominent button or CTA
      const button =
        document.querySelector("button") ||
        document.querySelector('a[class*="button"]') ||
        document.querySelector('a[class*="btn"]') ||
        document.querySelector(".cta");

      const buttonStyles = button ? window.getComputedStyle(button) : null;

      return {
        bodyBg: bodyStyles.backgroundColor,
        bodyText: bodyStyles.color,
        buttonBg: buttonStyles?.backgroundColor,
      };
    });

    return colors;
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
