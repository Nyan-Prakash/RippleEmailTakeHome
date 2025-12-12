import { z } from "zod";
import {
  CampaignTypeSchema,
  SectionTypeSchema,
  LayoutVariantSchema,
} from "./primitives";

/**
 * Section plan (structure only, no copy)
 */
export const SectionPlanSchema = z.object({
  type: SectionTypeSchema,
  variant: LayoutVariantSchema.optional(),
  count: z.number().int().min(2).max(8).optional(), // For productGrid
});

export type SectionPlan = z.infer<typeof SectionPlanSchema>;

/**
 * Email plan (decides structure without writing copy)
 * Must include at least header, hero, and footer
 */
export const EmailPlanSchema = z
  .object({
    campaignType: CampaignTypeSchema,
    goal: z.string().trim().min(10).max(500),
    sections: z
      .array(SectionPlanSchema)
      .min(3, "Must include at least 3 sections"),
  })
  .refine(
    (data) => {
      const types = data.sections.map((s) => s.type);
      return (
        types.includes("header") &&
        types.includes("hero") &&
        types.includes("footer")
      );
    },
    {
      message:
        "Plan must include at least one header, hero, and footer section",
    }
  );

export type EmailPlan = z.infer<typeof EmailPlanSchema>;
