import { z } from "zod";
import { HexColorSchema } from "./primitives";

/**
 * Product catalog item
 */
export const ProductSchema = z.object({
  id: z.string().trim().min(1, "Product ID is required"),
  title: z.string().trim().min(1, "Product title is required"),
  price: z.string().trim().min(1, "Product price is required"),
  image: z.string().trim().min(1, "Product image URL is required"),
  url: z.string().url("Product URL must be a valid URL"),
});

export type Product = z.infer<typeof ProductSchema>;

/**
 * Brand color palette
 */
export const BrandColorsSchema = z
  .object({
    primary: HexColorSchema,
    background: HexColorSchema,
    text: HexColorSchema,
  })
  .default({
    primary: "#111111",
    background: "#FFFFFF",
    text: "#111111",
  });

export type BrandColors = z.infer<typeof BrandColorsSchema>;

/**
 * Brand fonts
 */
export const BrandFontsSchema = z
  .object({
    heading: z.string().trim().min(1),
    body: z.string().trim().min(1),
  })
  .default({
    heading: "Arial",
    body: "Arial",
  });

export type BrandFonts = z.infer<typeof BrandFontsSchema>;

/**
 * Brand snippets (tagline, headlines, CTAs, etc.)
 * Extensible object with optional known fields
 */
export const BrandSnippetsSchema = z
  .object({
    tagline: z.string().trim().optional(),
    headlines: z.array(z.string().trim()).max(50).optional(),
    ctas: z.array(z.string().trim()).max(50).optional(),
  })
  .passthrough() // Allow additional fields
  .default({});

export type BrandSnippets = z.infer<typeof BrandSnippetsSchema>;

/**
 * Core brand information
 */
export const BrandSchema = z.object({
  name: z.string().trim().min(1).default("Unknown Brand"),
  website: z.string().url("Brand website must be a valid URL"),
  logoUrl: z.string().trim().default(""),
  colors: BrandColorsSchema,
  fonts: BrandFontsSchema,
  voiceHints: z.array(z.string().trim()).max(20).default([]),
  snippets: BrandSnippetsSchema,
});

export type Brand = z.infer<typeof BrandSchema>;

/**
 * Complete BrandContext
 * This is the canonical brand representation passed to LLMs
 */
export const BrandContextSchema = z.object({
  brand: BrandSchema,
  catalog: z.array(ProductSchema).default([]),
  trust: z.record(z.string(), z.string()).default({}),
});

export type BrandContext = z.infer<typeof BrandContextSchema>;
