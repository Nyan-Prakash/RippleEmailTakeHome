import { z } from "zod";
import {
  HexColorSchema,
  SectionTypeSchema,
  BackgroundTypeSchema,
  ButtonStyleSchema,
  TextColorTokenSchema,
  ContainerStyleSchema,
  DividerPositionSchema,
  CardBorderSchema,
  CardShadowSchema,
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
 * Extended color palette with brand-derived tokens
 */
export const PaletteSchema = z.object({
  primary: HexColorSchema,
  ink: HexColorSchema,
  bg: HexColorSchema,
  surface: HexColorSchema,
  muted: HexColorSchema,
  accent: HexColorSchema,
  primarySoft: HexColorSchema,
  accentSoft: HexColorSchema,
});

export type Palette = z.infer<typeof PaletteSchema>;

/**
 * Rhythm (spacing tokens)
 */
export const RhythmSchema = z.object({
  sectionGap: z.number().int().min(0).max(64).default(24),
  contentPaddingX: z.number().int().min(0).max(64).default(16),
  contentPaddingY: z.number().int().min(0).max(64).default(24),
});

export type Rhythm = z.infer<typeof RhythmSchema>;

/**
 * Button component configuration
 */
export const ButtonThemeSchema = z.object({
  radius: z.number().int().min(0).max(24).default(8),
  style: ButtonStyleSchema.default("solid"),
  paddingY: z.number().int().min(0).max(32).default(12),
  paddingX: z.number().int().min(0).max(64).default(24),
});

export type ButtonTheme = z.infer<typeof ButtonThemeSchema>;

/**
 * Card component configuration
 */
export const CardThemeSchema = z.object({
  radius: z.number().int().min(0).max(24).default(8),
  border: CardBorderSchema.default("none"),
  shadow: CardShadowSchema.default("none"),
});

export type CardTheme = z.infer<typeof CardThemeSchema>;

/**
 * Component tokens
 */
export const ComponentsSchema = z.object({
  button: ButtonThemeSchema.default({
    radius: 8,
    style: "solid" as const,
    paddingY: 12,
    paddingX: 24,
  }),
  card: CardThemeSchema.default({
    radius: 8,
    border: "none" as const,
    shadow: "none" as const,
  }),
});

export type Components = z.infer<typeof ComponentsSchema>;

/**
 * Font definition with optional source URL
 */
export const FontDefSchema = z.object({
  name: z.string().trim().min(1),
  sourceUrl: z.string().url().optional(),
});

export type FontDef = z.infer<typeof FontDefSchema>;

/**
 * Font configuration (supports both string and FontDef object)
 */
export const FontConfigSchema = z.object({
  heading: z.union([z.string().trim(), FontDefSchema]).default("Arial"),
  body: z.union([z.string().trim(), FontDefSchema]).default("Arial"),
});

export type FontConfig = z.infer<typeof FontConfigSchema>;

/**
 * Theme (design tokens)
 */
export const ThemeSchema = z.object({
  containerWidth: z.number().int().min(480).max(720).default(600),
  // Legacy color fields (backward compatible)
  backgroundColor: HexColorSchema.default("#FFFFFF"),
  surfaceColor: HexColorSchema.default("#F5F5F5"),
  textColor: HexColorSchema.default("#111111"),
  mutedTextColor: HexColorSchema.default("#666666"),
  primaryColor: HexColorSchema.default("#111111"),
  // New extended palette
  palette: PaletteSchema.optional(),
  rhythm: RhythmSchema.optional(),
  font: FontConfigSchema.default({ heading: "Arial", body: "Arial" }),
  // Legacy button field (backward compatible)
  button: ButtonThemeSchema.default({
    radius: 8,
    style: "solid" as const,
    paddingY: 12,
    paddingX: 24,
  }),
  // New component tokens
  components: ComponentsSchema.optional(),
});

export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Section style (padding, background, text color, container, divider)
 * v2: Enhanced with token-based padding and width options
 */
export const SectionStyleSchema = z.object({
  // Legacy numeric padding (backward compatible)
  paddingX: z.number().int().min(0).max(64).optional(),
  paddingY: z.number().int().min(0).max(64).optional(),
  // v2: Token-based padding (preferred)
  paddingYToken: z.enum(["sm", "md", "lg"]).optional(),
  // Background token
  background: BackgroundTypeSchema.optional(),
  // Text color token
  text: TextColorTokenSchema.optional(),
  // Container style
  container: ContainerStyleSchema.optional(),
  // Legacy divider (backward compatible)
  divider: DividerPositionSchema.optional(),
  // v2: Content width
  contentWidth: z.enum(["full", "narrow"]).optional(),
  // v2: Border radius
  borderRadius: z.enum(["none", "sm", "md"]).optional(),
  // v2: Section dividers
  dividerTop: z.enum(["none", "hairline", "spacer"]).optional(),
  dividerBottom: z.enum(["none", "hairline", "spacer"]).optional(),
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
 * Section metadata (influences rendering and copy generation)
 */
export const SectionMetadataSchema = z.object({
  intent: z.enum(["emotion", "conversion", "education", "trust"]).optional(),
  density: z.enum(["airy", "balanced", "compact"]).optional(),
  emphasis: z.enum(["low", "medium", "high"]).optional(),
  voice: z.array(z.string().trim()).max(5, "Max 5 voice descriptors").optional(),
  avoid: z.array(z.string().trim()).max(5, "Max 5 avoid descriptors").optional(),
});

export type SectionMetadata = z.infer<typeof SectionMetadataSchema>;

/**
 * Section (one stack unit in the email)
 */
export const SectionSchema = z.object({
  id: z.string().trim().min(1, "Section ID is required"),
  type: SectionTypeSchema,
  variant: z.string().trim().optional(),
  layout: LayoutSchema.optional(),
  blocks: z.array(BlockSchema),
  style: SectionStyleSchema.optional(),
  metadata: SectionMetadataSchema.optional(),
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
      button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
    }),
    sections: z
      .array(SectionSchema)
      .min(3, "Must have at least 3 sections")
      .max(12, "Maximum 12 sections allowed"),
    catalog: CatalogSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Check for required header and footer sections
    const sectionTypes = data.sections.map((s) => s.type);
    // v2: Allow header, navHeader, or announcementBar as valid header types
    const headerTypes = ["header", "navHeader", "announcementBar"];
    const hasHeader = sectionTypes.some(type => headerTypes.includes(type));
    const hasFooter = sectionTypes.includes("footer");

    if (!hasHeader) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must include at least one header section (header, navHeader, or announcementBar)",
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
