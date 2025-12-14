import { z } from "zod";

/**
 * Section types allowed in EmailSpec
 * These map to high-level email structure components
 */
export const SectionTypeSchema = z.enum([
  // Original types
  "header",
  "hero",
  "feature",
  "productGrid",
  "testimonial",
  "trustBar",
  "footer",
  // Existing enhanced types
  "announcementBar",
  "navHeader",
  "benefitsList",
  "storySection",
  "socialProofGrid",
  "faq",
  "secondaryCTA",
  "legalFinePrint",
  // NEW v2 section types
  "sectionTitle",
  "featureGrid",
  "productSpotlight",
  "comparison",
  "metricStrip",
  "testimonialCard",
  "ctaBanner",
  "faqMini",
  "dividerBand",
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
  // New block types
  "badge",
  "bullets",
  "priceLine",
  "rating",
  "navLinks",
  "socialIcons",
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
 * Background type for sections (tokenized backgrounds)
 */
export const BackgroundTypeSchema = z.enum([
  // Legacy tokens (backward compatible)
  "brand",
  "transparent",
  // Standard v2 background tokens
  "base",      // Base background (white/light)
  "alt",       // Alternate background (light gray)
  "surface",   // Surface background
  "bg",        // Alias for base
  "muted",     // Muted background
  "brandTint", // Brand color with low opacity
  "brandSolid", // Full brand color
  "primarySoft",
  "accentSoft",
  "primary",
  "accent",
  "image",
]);

export type BackgroundType = z.infer<typeof BackgroundTypeSchema>;

/**
 * Button variants
 */
export const ButtonVariantSchema = z.enum(["primary", "secondary"]);

export type ButtonVariant = z.infer<typeof ButtonVariantSchema>;

/**
 * Button styles
 */
export const ButtonStyleSchema = z.enum(["solid", "outline", "soft"]);

export type ButtonStyle = z.infer<typeof ButtonStyleSchema>;

/**
 * Text/block alignment
 */
export const AlignmentSchema = z.enum(["left", "center", "right"]);

export type Alignment = z.infer<typeof AlignmentSchema>;

/**
 * Heading levels (h1, h2, h3)
 * 
 * Header sections (header, navHeader, announcementBar) render with significantly larger fonts:
 * - h1: 48px (vs 32px in other sections)
 * - h2: 36px (vs 28px in other sections)
 * - h3: 30px (vs 24px in other sections)
 * 
 * This ensures headers are the most eye-catching elements with the greatest visual contrast
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

/**
 * Text color tokens for section styling
 */
export const TextColorTokenSchema = z.enum(["ink", "bg"]);

export type TextColorToken = z.infer<typeof TextColorTokenSchema>;

/**
 * Container style tokens for sections
 */
export const ContainerStyleSchema = z.enum(["flat", "card"]);

export type ContainerStyle = z.infer<typeof ContainerStyleSchema>;

/**
 * Divider position for sections
 */
export const DividerPositionSchema = z.enum(["none", "top", "bottom", "both"]);

export type DividerPosition = z.infer<typeof DividerPositionSchema>;

/**
 * Card border styles
 */
export const CardBorderSchema = z.enum(["none", "hairline"]);

export type CardBorder = z.infer<typeof CardBorderSchema>;

/**
 * Card shadow styles
 */
export const CardShadowSchema = z.enum(["none", "soft"]);

export type CardShadow = z.infer<typeof CardShadowSchema>;

/**
 * Badge tone tokens
 */
export const BadgeToneSchema = z.enum([
  "primary",
  "accent",
  "muted",
  "success",
  "warning",
  "error",
]);

export type BadgeTone = z.infer<typeof BadgeToneSchema>;

/**
 * Social network types
 */
export const SocialNetworkSchema = z.enum([
  "facebook",
  "twitter",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
]);

export type SocialNetwork = z.infer<typeof SocialNetworkSchema>;

/**
 * Section padding size tokens (v2)
 */
export const PaddingYTokenSchema = z.enum(["sm", "md", "lg"]);

export type PaddingYToken = z.infer<typeof PaddingYTokenSchema>;

/**
 * Content width tokens (v2)
 */
export const ContentWidthTokenSchema = z.enum(["full", "narrow"]);

export type ContentWidthToken = z.infer<typeof ContentWidthTokenSchema>;

/**
 * Corner radius tokens (v2)
 */
export const CornerRadiusTokenSchema = z.enum(["none", "sm", "md"]);

export type CornerRadiusToken = z.infer<typeof CornerRadiusTokenSchema>;

/**
 * Section divider tokens (v2)
 */
export const SectionDividerTokenSchema = z.enum(["none", "hairline", "spacer"]);

export type SectionDividerToken = z.infer<typeof SectionDividerTokenSchema>;

/**
 * Header variant types (v2)
 */
export const HeaderVariantSchema = z.enum([
  "minimal",
  "brandBar",
  "centered",
  "withUtilityLinks",
]);

export type HeaderVariant = z.infer<typeof HeaderVariantSchema>;

/**
 * Footer variant types (v2)
 */
export const FooterVariantSchema = z.enum([
  "minimalCompliance",
  "supportFocused",
  "socialLight",
]);

export type FooterVariant = z.infer<typeof FooterVariantSchema>;
