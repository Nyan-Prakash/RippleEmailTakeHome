import { EmailSpecSchema, type EmailSpec } from "../schemas/emailSpec";
import { nanoid } from "nanoid";

/**
 * Normalize EmailSpec
 * - Apply theme defaults
 * - Trim all text fields
 * - Clamp numeric values
 * - Ensure unique section IDs (generate if missing)
 * - Sanitize text (done automatically by block schemas)
 */
export function normalizeEmailSpec(input: unknown): EmailSpec {
  // First parse with Zod for validation and defaults
  const parsed = EmailSpecSchema.parse(input);

  // Ensure all sections have unique IDs
  const usedIds = new Set<string>();

  parsed.sections = parsed.sections.map((section) => {
    let id = section.id;

    // Generate ID if missing or duplicate
    if (!id || usedIds.has(id)) {
      id = `section-${nanoid(8)}`;
    }

    usedIds.add(id);

    // Clamp padding values if present
    const style = section.style
      ? {
          ...section.style,
          paddingX:
            section.style.paddingX !== undefined
              ? Math.max(0, Math.min(64, section.style.paddingX))
              : undefined,
          paddingY:
            section.style.paddingY !== undefined
              ? Math.max(0, Math.min(64, section.style.paddingY))
              : undefined,
        }
      : undefined;

    return {
      ...section,
      id,
      style,
    };
  });

  // Clamp theme values
  parsed.theme.containerWidth = Math.max(
    480,
    Math.min(720, parsed.theme.containerWidth)
  );
  parsed.theme.button.radius = Math.max(
    0,
    Math.min(24, parsed.theme.button.radius)
  );

  return parsed;
}
