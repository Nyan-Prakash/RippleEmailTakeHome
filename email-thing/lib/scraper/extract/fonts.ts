import type { Page } from "playwright";

/**
 * Extracted fonts
 */
export interface ExtractedFonts {
  heading: string;
  body: string;
}

/**
 * System default fonts to ignore
 */
const SYSTEM_FONTS = new Set([
  "arial",
  "helvetica",
  "times",
  "times new roman",
  "courier",
  "courier new",
  "verdana",
  "georgia",
  "palatino",
  "garamond",
  "bookman",
  "comic sans ms",
  "trebuchet ms",
  "impact",
  "sans-serif",
  "serif",
  "monospace",
]);

/**
 * Extract fonts from page
 * Reads computed font-family on body and headings
 */
export async function extractFonts(page: Page): Promise<ExtractedFonts> {
  const defaults: ExtractedFonts = {
    heading: "Arial, sans-serif",
    body: "Arial, sans-serif",
  };

  try {
    const fonts = await page.evaluate(() => {
      const body = document.body;
      const heading =
        document.querySelector("h1") || document.querySelector("h2");

      const bodyStyles = window.getComputedStyle(body);
      const headingStyles = heading ? window.getComputedStyle(heading) : null;

      return {
        body: bodyStyles.fontFamily,
        heading: headingStyles?.fontFamily || bodyStyles.fontFamily,
      };
    });

    return {
      heading: cleanFontFamily(fonts.heading) || defaults.heading,
      body: cleanFontFamily(fonts.body) || defaults.body,
    };
  } catch {
    return defaults;
  }
}

/**
 * Clean and normalize font-family string
 * Returns the first non-system font, or fallback
 */
function cleanFontFamily(fontFamily: string): string | null {
  if (!fontFamily) return null;

  // Split by comma and process each font
  const fonts = fontFamily.split(",").map((f) =>
    f
      .trim()
      .replace(/^["']|["']$/g, "")
      .toLowerCase()
  );

  // Find first non-system font
  for (const font of fonts) {
    if (!SYSTEM_FONTS.has(font)) {
      // Capitalize properly
      return font
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
  }

  return null;
}
