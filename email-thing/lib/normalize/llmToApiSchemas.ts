/**
 * Normalize LLM schemas to API schemas
 * Converts data from LLM parsers to the format expected by generateEmailSpec and validators
 */

import type { CampaignIntent as LLMCampaignIntent } from "../llm/schemas/campaignIntent";
import type { EmailPlan as LLMEmailPlan } from "../llm/schemas/emailPlan";
import type { CampaignIntent as APICampaignIntent } from "../schemas/campaign";
import type { EmailPlan as APIEmailPlan } from "../schemas/plan";

/**
 * Map LLM campaign types to API campaign types
 */
function normalizeCampaignType(
  llmType: LLMCampaignIntent["type"]
): APICampaignIntent["type"] {
  const typeMap: Record<LLMCampaignIntent["type"], APICampaignIntent["type"]> =
    {
      sale: "sale",
      product_launch: "launch",
      back_in_stock: "backInStock",
      newsletter: "newsletter",
      holiday: "sale", // Map holiday to sale
      winback: "winback",
      announcement: "generic",
      other: "generic",
    };
  return typeMap[llmType];
}

/**
 * Map LLM section types to API section types
 */
function normalizeSectionType(
  llmType: LLMEmailPlan["sections"][number]["type"]
): APIEmailPlan["sections"][number]["type"] {
  const typeMap: Record<
    LLMEmailPlan["sections"][number]["type"],
    APIEmailPlan["sections"][number]["type"]
  > = {
    // Header types
    header: "header",
    nav_header: "navHeader",
    announcement_bar: "announcementBar",

    // Main content types
    hero: "hero",
    value_props: "feature",
    feature_grid: "featureGrid",
    benefits_list: "benefitsList",
    story_section: "storySection",
    product_feature: "feature",
    product_grid: "productGrid",
    product_spotlight: "productSpotlight",
    comparison: "comparison",

    // Social proof / trust
    social_proof: "testimonial",
    social_proof_grid: "socialProofGrid",
    testimonial: "testimonial",
    testimonial_card: "testimonialCard",
    trust_bar: "trustBar",
    metric_strip: "metricStrip",

    // CTAs and banners
    promo_banner: "trustBar",
    cta_section: "secondaryCTA",
    cta_banner: "ctaBanner",
    secondary_cta: "secondaryCTA",

    // Support / info
    faq: "faq",
    faq_mini: "faqMini",
    legal_fine_print: "legalFinePrint",

    // Visual elements
    section_title: "sectionTitle",
    divider_band: "dividerBand",

    // Footer
    footer: "footer",
  };
  return typeMap[llmType];
}

/**
 * Infer layout variant from template
 */
function inferLayoutVariant(
  template?: LLMEmailPlan["layout"]["template"]
): "single" | "twoColumn" | "grid" | undefined {
  if (!template) return "single"; // Default if no template provided
  // Map templates to their typical layout patterns
  if (template === "product_grid") return "grid";
  if (template === "hero_with_products") return "twoColumn";
  return "single"; // Default for hero, editorial, announcement, newsletter, minimal
}

/**
 * Normalize LLM CampaignIntent to API CampaignIntent
 */
export function normalizeCampaignIntent(
  llmIntent: LLMCampaignIntent
): APICampaignIntent {
  // Convert offer object to string
  let offerString: string | undefined;
  if (llmIntent.offer && llmIntent.offer.kind !== "none") {
    offerString = llmIntent.offer.details || llmIntent.offer.kind;
    if (llmIntent.offer.value) {
      offerString = `${llmIntent.offer.value}${llmIntent.offer.kind === "percent" ? "%" : ""} ${offerString || ""}`.trim();
    }
  }

  // Filter out "other" and "informative" from tone
  const tone =
    llmIntent.tone === "other" || llmIntent.tone === "informative"
      ? undefined
      : llmIntent.tone;

  return {
    type: normalizeCampaignType(llmIntent.type),
    tone,
    offer: offerString,
    urgency: llmIntent.urgency
      ? `${llmIntent.urgency} urgency`
      : undefined,
    audience: llmIntent.audience,
    ctaText: llmIntent.cta?.primary,
    notes: llmIntent.rationale, // Use rationale as notes
  };
}

/**
 * Normalize LLM EmailPlan to API EmailPlan
 */
export function normalizeEmailPlan(
  llmPlan: LLMEmailPlan,
  llmIntent: LLMCampaignIntent
): APIEmailPlan {
  return {
    campaignType: normalizeCampaignType(llmIntent.type),
    goal: llmIntent.goal,
    sections: llmPlan.sections.map((section) => ({
      type: normalizeSectionType(section.type),
      variant: inferLayoutVariant(llmPlan.layout?.template),
      count: section.productIds?.length || undefined,
    })),
  };
}
