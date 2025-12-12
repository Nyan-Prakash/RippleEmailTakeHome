import { z } from "zod";
import {
  HexColorSchema,
  SectionTypeSchema,
  BackgroundTypeSchema,
  ButtonStyleSchema,
} from "./primitives";
import { BlockSchema } from "./blocks";
import { ProductSchema } from "./brand";

/**
 * Email metadata (subject, preheader)
 */
export const EmailMetaSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(5)
    .max(150, "Subject must be 5-150 characters"),
  preheader: z
    .string()
    .trim()
    .min(10)
    .max(200, "Preheader must be 10-200 characters"),
});

export type EmailMeta = z.infer<typeof EmailMetaSchema>;

/**
 * Button theme configuration
 */
export const ButtonThemeSchema = z.object({
  radius: z.number().int().min(0).max(24).default(8),
  style: ButtonStyleSchema.default("solid"),
});

export type ButtonTheme = z.infer<typeof ButtonThemeSchema>;

/**
 * Font configuration
 */
export const FontConfigSchema = z.object({
  heading: z.string().trim().default("Arial"),
  body: z.string().trim().default("Arial"),
});

export type FontConfig = z.infer<typeof FontConfigSchema>;

/**
 * Theme (design tokens)
 */
export const ThemeSchema = z.object({
  containerWidth: z.number().int().min(480).max(720).default(600),
  backgroundColor: HexColorSchema.default("#FFFFFF"),
  surfaceColor: HexColorSchema.default("#F5F5F5"),
  textColor: HexColorSchema.default("#111111"),
  mutedTextColor: HexColorSchema.default("#666666"),
  primaryColor: HexColorSchema.default("#111111"),
  font: FontConfigSchema.default({ heading: "Arial", body: "Arial" }),
  button: ButtonThemeSchema.default({ radius: 8, style: "solid" }),
});

export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Section style (padding, background)
 */
export const SectionStyleSchema = z.object({
  paddingX: z.number().int().min(0).max(64).optional(),
  paddingY: z.number().int().min(0).max(64).optional(),
  background: BackgroundTypeSchema.optional(),
});

export type SectionStyle = z.infer<typeof SectionStyleSchema>;

/**
 * Column specification for two-column layout
 */
export const ColumnSpecSchema = z.object({
  width: z.string().regex(/^\d+%$/, "Width must be a percentage (e.g., '50%')"),
  blocks: z.array(BlockSchema),
});

export type ColumnSpec = z.infer<typeof ColumnSpecSchema>;

/**
 * Layout configurations
 */
export const SingleLayoutSchema = z.object({
  variant: z.literal("single"),
});

export const TwoColumnLayoutSchema = z.object({
  variant: z.literal("twoColumn"),
  columns: z.tuple([ColumnSpecSchema, ColumnSpecSchema]).optional(),
});

export const GridLayoutSchema = z.object({
  variant: z.literal("grid"),
  columns: z.union([z.literal(2), z.literal(3)]),
  gap: z.number().int().min(0),
});

export const LayoutSchema = z.discriminatedUnion("variant", [
  SingleLayoutSchema,
  TwoColumnLayoutSchema,
  GridLayoutSchema,
]);

export type Layout =
  | z.infer<typeof SingleLayoutSchema>
  | z.infer<typeof TwoColumnLayoutSchema>
  | z.infer<typeof GridLayoutSchema>;

/**
 * Section (one stack unit in the email)
 */
export const SectionSchema = z.object({
  id: z.string().trim().min(1, "Section ID is required"),
  type: SectionTypeSchema,
  layout: LayoutSchema.optional(),
  blocks: z.array(BlockSchema),
  style: SectionStyleSchema.optional(),
});

export type Section = z.infer<typeof SectionSchema>;

/**
 * Product catalog (optional)
 */
export const CatalogSchema = z.object({
  items: z.array(ProductSchema),
});

export type Catalog = z.infer<typeof CatalogSchema>;

/**
 * EmailSpec - The canonical email specification
 * This is the most important contract in the system
 */
export const EmailSpecSchema = z.object({
  meta: EmailMetaSchema,
  theme: ThemeSchema.default({
    containerWidth: 600,
    backgroundColor: "#FFFFFF",
    surfaceColor: "#F5F5F5",
    textColor: "#111111",
    mutedTextColor: "#666666",
    primaryColor: "#111111",
    font: { heading: "Arial", body: "Arial" },
    button: { radius: 8, style: "solid" as const },
  }),
  sections: z.array(SectionSchema).min(1, "At least one section is required"),
  catalog: CatalogSchema.optional(),
});

export type EmailSpec = z.infer<typeof EmailSpecSchema>;
