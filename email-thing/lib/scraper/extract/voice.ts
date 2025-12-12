import type { CheerioAPI } from "cheerio";

/**
 * Extracted voice signals
 */
export interface VoiceSignals {
  voiceHints: string[];
  snippets: {
    tagline?: string;
    headlines?: string[];
    ctas?: string[];
  };
}

/**
 * Extract voice snippets from HTML
 * Collects hero headlines, CTA labels, and taglines
 */
export function extractVoiceSnippets($: CheerioAPI): VoiceSignals {
  const headlines: string[] = [];
  const ctas: string[] = [];
  let tagline: string | undefined;

  // Extract hero headlines (h1, h2 in hero/banner sections)
  $("h1, h2").each((_, elem) => {
    const text = $(elem).text().trim();
    if (text.length > 5 && text.length < 200) {
      // Check if in a hero/banner context
      const parent = $(elem).parent();
      const parentClass = parent.attr("class") || "";
      const parentId = parent.attr("id") || "";

      if (
        parentClass.includes("hero") ||
        parentClass.includes("banner") ||
        parentId.includes("hero") ||
        parentId.includes("banner")
      ) {
        headlines.push(text);
      } else {
        // Add first few h1/h2 regardless
        if (headlines.length < 3) {
          headlines.push(text);
        }
      }
    }
  });

  // Extract CTA button text
  $("button, a.button, a.btn, .cta").each((_, elem) => {
    const text = $(elem).text().trim();
    if (text.length > 2 && text.length < 50) {
      ctas.push(text);
    }
  });

  // Extract tagline (look for specific classes/elements)
  const taglineSelectors = [
    ".tagline",
    ".slogan",
    ".subtitle",
    '[class*="tagline"]',
    '[class*="slogan"]',
  ];

  for (const selector of taglineSelectors) {
    const text = $(selector).first().text().trim();
    if (text.length > 5 && text.length < 150) {
      tagline = text;
      break;
    }
  }

  // Deduplicate and limit
  const uniqueHeadlines = [...new Set(headlines)].slice(0, 5);
  const uniqueCtas = [...new Set(ctas)].slice(0, 5);

  // Combine all for voiceHints
  const voiceHints = [
    ...(tagline ? [tagline] : []),
    ...uniqueHeadlines.slice(0, 3),
    ...uniqueCtas.slice(0, 3),
  ]
    .filter(Boolean)
    .slice(0, 10);

  return {
    voiceHints,
    snippets: {
      tagline,
      headlines: uniqueHeadlines.length > 0 ? uniqueHeadlines : undefined,
      ctas: uniqueCtas.length > 0 ? uniqueCtas : undefined,
    },
  };
}
