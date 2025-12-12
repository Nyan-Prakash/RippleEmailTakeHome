import { z } from "zod";
import { CampaignTypeSchema, ToneSchema } from "./primitives";

/**
 * Campaign intent extracted from user prompt
 * Represents structured understanding of what the user wants
 */
export const CampaignIntentSchema = z.object({
  type: CampaignTypeSchema.default("generic"),
  tone: ToneSchema.optional(),
  offer: z.string().trim().max(500).optional(),
  urgency: z.string().trim().max(200).optional(),
  audience: z.string().trim().max(300).optional(),
  ctaText: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type CampaignIntent = z.infer<typeof CampaignIntentSchema>;
