import { z } from "zod";
import {
  AlignmentSchema,
  HeadingLevelSchema,
  ButtonVariantSchema,
} from "./primitives";

/**
 * Helper to sanitize text (strip HTML tags)
 */
const sanitizeText = (text: string): string => {
  return text.replace(/[<>]/g, "");
};

/**
 * Create a sanitized string schema with minimum length
 */
const createSanitizedStringSchema = (min?: number) => {
  let schema = z.string().trim();
  if (min !== undefined) {
    schema = schema.min(min);
  }
  return schema.transform(sanitizeText);
};

/**
 * URL schema (http/https or empty string)
 */
const UrlSchema = z
  .string()
  .trim()
  .refine(
    (url) => {
      if (url === "") return true;
      return url.startsWith("http://") || url.startsWith("https://");
    },
    { message: "URL must start with http:// or https://, or be empty" }
  );

/**
 * Logo block
 */
export const LogoBlockSchema = z.object({
  type: z.literal("logo"),
  src: z.string().trim().min(1, "Logo src is required"),
  href: UrlSchema.optional(),
  align: AlignmentSchema.optional(),
});

export type LogoBlock = z.infer<typeof LogoBlockSchema>;

/**
 * Heading block
 */
export const HeadingBlockSchema = z.object({
  type: z.literal("heading"),
  text: createSanitizedStringSchema(1),
  align: AlignmentSchema.optional(),
  level: HeadingLevelSchema.optional(),
});

export type HeadingBlock = z.infer<typeof HeadingBlockSchema>;

/**
 * Paragraph block
 */
export const ParagraphBlockSchema = z.object({
  type: z.literal("paragraph"),
  text: createSanitizedStringSchema(1),
  align: AlignmentSchema.optional(),
});

export type ParagraphBlock = z.infer<typeof ParagraphBlockSchema>;

/**
 * Image block
 */
export const ImageBlockSchema = z.object({
  type: z.literal("image"),
  src: z.string().trim().min(1, "Image src is required"),
  alt: createSanitizedStringSchema(1),
  href: UrlSchema.optional(),
  align: AlignmentSchema.optional(),
});

export type ImageBlock = z.infer<typeof ImageBlockSchema>;

/**
 * Button block
 */
export const ButtonBlockSchema = z.object({
  type: z.literal("button"),
  text: createSanitizedStringSchema(1),
  href: z.string().url("Button href must be a valid URL"),
  align: AlignmentSchema.optional(),
  variant: ButtonVariantSchema.optional(),
});

export type ButtonBlock = z.infer<typeof ButtonBlockSchema>;

/**
 * Product card block (references a product in catalog)
 */
export const ProductCardBlockSchema = z.object({
  type: z.literal("productCard"),
  productRef: z.string().trim().min(1, "Product reference is required"),
});

export type ProductCardBlock = z.infer<typeof ProductCardBlockSchema>;

/**
 * Divider block
 */
export const DividerBlockSchema = z.object({
  type: z.literal("divider"),
});

export type DividerBlock = z.infer<typeof DividerBlockSchema>;

/**
 * Spacer block
 */
export const SpacerBlockSchema = z.object({
  type: z.literal("spacer"),
  size: z.number().int().min(4).max(64, "Spacer size must be between 4 and 64"),
});

export type SpacerBlock = z.infer<typeof SpacerBlockSchema>;

/**
 * Small print block (footer text, legal, unsubscribe)
 */
export const SmallPrintBlockSchema = z.object({
  type: z.literal("smallPrint"),
  text: createSanitizedStringSchema(1),
  align: AlignmentSchema.optional(),
});

export type SmallPrintBlock = z.infer<typeof SmallPrintBlockSchema>;

/**
 * Discriminated union of all block types
 */
export const BlockSchema = z.discriminatedUnion("type", [
  LogoBlockSchema,
  HeadingBlockSchema,
  ParagraphBlockSchema,
  ImageBlockSchema,
  ButtonBlockSchema,
  ProductCardBlockSchema,
  DividerBlockSchema,
  SpacerBlockSchema,
  SmallPrintBlockSchema,
]);

export type Block = z.infer<typeof BlockSchema>;
