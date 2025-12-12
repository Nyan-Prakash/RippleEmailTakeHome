import { z } from "zod";

/**
 * Offer schema for campaign intent
 */
const OfferSchema = z.object({
  kind: z.enum([
    "percent",
    "fixed_amount",
    "free_shipping",
    "bogo",
    "none",
    "other",
  ]),
  value: z.number().optional(),
  details: z.string().max(80).optional(),
});

/**
 * Time window schema for campaign intent
 */
const TimeWindowSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

/**
 * CTA (Call-to-Action) schema
 */
const CTASchema = z.object({
  primary: z.string().max(40),
  secondary: z.string().max(40).optional(),
});

/**
 * Campaign Intent schema - structured output from LLM parsing
 */
export const CampaignIntentSchema = z.object({
  type: z.enum([
    "sale",
    "product_launch",
    "back_in_stock",
    "newsletter",
    "holiday",
    "winback",
    "announcement",
    "other",
  ]),
  goal: z.string().max(120),
  audience: z.string().max(80).optional(),
  offer: OfferSchema.optional(),
  urgency: z.enum(["low", "medium", "high"]),
  timeWindow: TimeWindowSchema.optional(),
  tone: z.enum([
    "playful",
    "premium",
    "minimal",
    "bold",
    "friendly",
    "urgent",
    "informative",
    "other",
  ]),
  cta: CTASchema,
  constraints: z.array(z.string()).max(6).optional(),
  keywords: z.array(z.string()).max(12),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(200),
});

/**
 * TypeScript type inferred from the schema
 */
export type CampaignIntent = z.infer<typeof CampaignIntentSchema>;
