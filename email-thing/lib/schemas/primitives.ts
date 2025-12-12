import { z } from "zod";

/**
 * Section types allowed in EmailSpec
 * These map to high-level email structure components
 */
export const SectionTypeSchema = z.enum([
  "header",
  "hero",
  "feature",
  "productGrid",
  "testimonial",
  "trustBar",
  "footer",
]);

export type SectionType = z.infer<typeof SectionTypeSchema>;

/**
 * Block types allowed in sections
 * These are atomic components that cannot contain other blocks
 */
export const BlockTypeSchema = z.enum([
  "logo",
  "heading",
  "paragraph",
  "image",
  "button",
  "productCard",
  "divider",
  "spacer",
  "smallPrint",
]);

export type BlockType = z.infer<typeof BlockTypeSchema>;

/**
 * Layout variants for sections
 */
export const LayoutVariantSchema = z.enum(["single", "twoColumn", "grid"]);

export type LayoutVariant = z.infer<typeof LayoutVariantSchema>;

/**
 * Campaign types for email intent
 */
export const CampaignTypeSchema = z.enum([
  "sale",
  "launch",
  "newsletter",
  "backInStock",
  "winback",
  "abandonedCart",
  "generic",
]);

export type CampaignType = z.infer<typeof CampaignTypeSchema>;

/**
 * Tone modifiers for campaign
 */
export const ToneSchema = z.enum([
  "playful",
  "premium",
  "minimal",
  "urgent",
  "friendly",
  "bold",
]);

export type Tone = z.infer<typeof ToneSchema>;

/**
 * Background type for sections
 */
export const BackgroundTypeSchema = z.enum(["brand", "surface", "transparent"]);

export type BackgroundType = z.infer<typeof BackgroundTypeSchema>;

/**
 * Button variants
 */
export const ButtonVariantSchema = z.enum(["primary", "secondary"]);

export type ButtonVariant = z.infer<typeof ButtonVariantSchema>;

/**
 * Button styles
 */
export const ButtonStyleSchema = z.enum(["solid", "outline"]);

export type ButtonStyle = z.infer<typeof ButtonStyleSchema>;

/**
 * Text/block alignment
 */
export const AlignmentSchema = z.enum(["left", "center", "right"]);

export type Alignment = z.infer<typeof AlignmentSchema>;

/**
 * Heading levels (h1, h2, h3)
 */
export const HeadingLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export type HeadingLevel = z.infer<typeof HeadingLevelSchema>;

/**
 * Hex color validation (#RRGGBB format only)
 */
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (#RRGGBB)");

export type HexColor = z.infer<typeof HexColorSchema>;
