import type { Page } from "playwright";
import type { BrandFont } from "@/lib/schemas/brand";

/**
 * Extracted fonts
 */
export interface ExtractedFonts {
  heading: string | BrandFont;
  body: string | BrandFont;
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
 * Reads computed font-family on body and headings, and attempts to find font source URLs
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

      // Extract font source URLs from stylesheets and link tags
      const fontSources: Record<string, string> = {};

      // Check link tags for font stylesheets
      const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      for (const link of linkTags) {
        const href = (link as HTMLLinkElement).href;
        if (href && (href.includes('fonts.googleapis.com') ||
                     href.includes('fonts.adobe.com') ||
                     href.includes('use.typekit.net') ||
                     href.includes('cloud.typography.com'))) {
          // Extract font name from URL or try to match with fonts in use
          fontSources['_stylesheet'] = href;
        }
      }

      // Check for @font-face rules in stylesheets
      try {
        const stylesheets = Array.from(document.styleSheets);
        for (const stylesheet of stylesheets) {
          try {
            const rules = Array.from(stylesheet.cssRules || []);
            for (const rule of rules) {
              if (rule instanceof CSSFontFaceRule) {
                const fontFamily = rule.style.fontFamily?.replace(/['"]/g, '');
                const src = rule.style.getPropertyValue('src');
                if (fontFamily && src) {
                  // Try to extract URL from src
                  const urlMatch = src.match(/url\(['"]?([^'"()]+)['"]?\)/);
                  if (urlMatch && urlMatch[1]) {
                    let fontUrl = urlMatch[1];
                    // Convert relative URLs to absolute
                    if (!fontUrl.startsWith('http')) {
                      fontUrl = new URL(fontUrl, window.location.href).href;
                    }
                    fontSources[fontFamily.toLowerCase()] = fontUrl;
                  }
                }
              } else if (rule instanceof CSSImportRule) {
                // Check for @import of font stylesheets
                const href = rule.href;
                if (href && (href.includes('fonts.googleapis.com') ||
                           href.includes('fonts.adobe.com') ||
                           href.includes('use.typekit.net'))) {
                  fontSources['_import'] = href;
                }
              }
            }
          } catch {
            // CORS or other access errors - skip this stylesheet
          }
        }
      } catch {
        // StyleSheet access error
      }

      return {
        body: bodyStyles.fontFamily,
        heading: headingStyles?.fontFamily || bodyStyles.fontFamily,
        fontSources,
      };
    });

    const headingName = cleanFontFamily(fonts.heading);
    const bodyName = cleanFontFamily(fonts.body);

    // Try to match font names with discovered sources
    const heading = headingName
      ? buildFontWithSource(headingName, fonts.fontSources)
      : defaults.heading;
    const body = bodyName
      ? buildFontWithSource(bodyName, fonts.fontSources)
      : defaults.body;

    return { heading, body };
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

/**
 * Common Google Fonts that should have sourceUrls
 */
const GOOGLE_FONTS = new Set([
  'inter', 'roboto', 'open sans', 'lato', 'montserrat', 'poppins',
  'raleway', 'source sans pro', 'work sans', 'nunito', 'pt sans',
  'rubik', 'dm sans', 'ubuntu', 'playfair display', 'merriweather',
  'oswald', 'mukta', 'manrope', 'space grotesk', 'plus jakarta sans',
]);

/**
 * Generate Google Fonts URL for a given font name
 */
function generateGoogleFontsUrl(fontName: string): string {
  const encodedName = fontName.replace(/\s+/g, '+');
  return `https://fonts.googleapis.com/css2?family=${encodedName}:wght@400;600;700&display=swap`;
}

/**
 * Build a BrandFont object with sourceUrl if available
 */
function buildFontWithSource(
  fontName: string,
  fontSources: Record<string, string>
): string | BrandFont {
  // Try exact match (case insensitive)
  const sourceUrl = fontSources[fontName.toLowerCase()];
  if (sourceUrl) {
    return { name: fontName, sourceUrl };
  }

  // Try generic stylesheet URLs (Google Fonts, Adobe Fonts, etc.)
  const genericSource = fontSources['_stylesheet'] || fontSources['_import'];
  if (genericSource) {
    return { name: fontName, sourceUrl: genericSource };
  }

  // Check if it's a known Google Font and generate URL
  if (GOOGLE_FONTS.has(fontName.toLowerCase())) {
    return { name: fontName, sourceUrl: generateGoogleFontsUrl(fontName) };
  }

  // No source found, return just the name
  return fontName;
}
