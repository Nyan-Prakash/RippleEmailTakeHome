import { BrandContextSchema, type BrandContext } from "../schemas/brand";

/**
 * Normalize BrandContext
 * Applies defaults, trims strings, validates colors, truncates arrays
 */
export function normalizeBrandContext(input: unknown): BrandContext {
  // First, parse with Zod to get type safety and basic validation
  const parsed = BrandContextSchema.parse(input);

  // Ensure URLs have protocol
  if (parsed.brand.website && !parsed.brand.website.startsWith("http")) {
    parsed.brand.website = `https://${parsed.brand.website}`;
  }

  // Truncate voiceHints to max 20
  if (parsed.brand.voiceHints.length > 20) {
    parsed.brand.voiceHints = parsed.brand.voiceHints.slice(0, 20);
  }

  // Truncate headlines/ctas in snippets
  if (
    parsed.brand.snippets.headlines &&
    parsed.brand.snippets.headlines.length > 50
  ) {
    parsed.brand.snippets.headlines = parsed.brand.snippets.headlines.slice(
      0,
      50
    );
  }

  if (parsed.brand.snippets.ctas && parsed.brand.snippets.ctas.length > 50) {
    parsed.brand.snippets.ctas = parsed.brand.snippets.ctas.slice(0, 50);
  }

  return parsed;
}
