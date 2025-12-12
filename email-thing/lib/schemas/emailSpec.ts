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
export const EmailSpecSchema = z
  .object({
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
    sections: z
      .array(SectionSchema)
      .min(3, "Must have at least 3 sections")
      .max(10, "Maximum 10 sections allowed"),
    catalog: CatalogSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Check for required header and footer sections
    const sectionTypes = data.sections.map((s) => s.type);
    const hasHeader = sectionTypes.includes("header");
    const hasFooter = sectionTypes.includes("footer");

    if (!hasHeader) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must include at least one 'header' section",
        path: ["sections"],
      });
    }

    if (!hasFooter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must include at least one 'footer' section",
        path: ["sections"],
      });
    }

    // Check for at least one button block (CTA requirement)
    let hasButton = false;
    for (const section of data.sections) {
      for (const block of section.blocks) {
        if (block.type === "button") {
          hasButton = true;
          break;
        }
      }
      if (hasButton) break;
    }

    if (!hasButton) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must include at least one 'button' block for CTA",
        path: ["sections"],
      });
    }

    // Get catalog product IDs
    const catalogProductIds = new Set(
      data.catalog?.items?.map((p) => p.id) || []
    );

    // Validate productCard blocks reference existing catalog items
    data.sections.forEach((section, sectionIdx) => {
      section.blocks.forEach((block, blockIdx) => {
        if (block.type === "productCard") {
          if (!catalogProductIds.has(block.productRef)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Product reference "${block.productRef}" not found in catalog`,
              path: ["sections", sectionIdx, "blocks", blockIdx, "productRef"],
            });
          }
        }
      });
    });

    // If catalog is empty, ensure no productCard blocks
    if (catalogProductIds.size === 0) {
      data.sections.forEach((section, sectionIdx) => {
        section.blocks.forEach((block, blockIdx) => {
          if (block.type === "productCard") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Cannot have productCard blocks when catalog is empty",
              path: ["sections", sectionIdx, "blocks", blockIdx],
            });
          }
        });
      });
    }
  });

export type EmailSpec = z.infer<typeof EmailSpecSchema>;
