import type { BrandContext } from "../schemas/brand";
import type { CampaignIntent } from "./schemas/campaignIntent";
import { EmailPlanSchema, type EmailPlan } from "./schemas/emailPlan";
import { createLLMError, LLM_ERROR_MESSAGES } from "./errors";

/**
 * LLM client interface for dependency injection
 */
export interface PlanEmailLLMClient {
  completeJson(input: {
    system: string;
    user: string;
    timeoutMs: number;
    temperature: number;
  }): Promise<string>;
}

/**
 * Default OpenAI implementation
 */
async function defaultLLMClient(input: {
  system: string;
  user: string;
  timeoutMs: number;
  temperature: number;
}): Promise<string> {
  const { default: OpenAI } = await import("openai");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw createLLMError(
      "LLM_CONFIG_MISSING",
      LLM_ERROR_MESSAGES.LLM_CONFIG_MISSING
    );
  }

  const client = new OpenAI({ apiKey, timeout: input.timeoutMs });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    temperature: input.temperature,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw createLLMError("LLM_FAILED", LLM_ERROR_MESSAGES.LLM_FAILED);
  }

  return content;
}

/**
 * Build system prompt for email planning
 */
function buildSystemPrompt(
  brandContext: BrandContext,
  intent: CampaignIntent
): string {
  const { brand, catalog } = brandContext;

  // Build catalog summary
  let catalogSummary = "No products in catalog.";
  if (catalog.length > 0) {
    catalogSummary = `${catalog.length} products available:\n`;
    catalogSummary += catalog
      .slice(0, 20) // Include first 20 products
      .map((p) => `- ID: ${p.id}, Title: ${p.title}, Price: ${p.price}`)
      .join("\n");
    if (catalog.length > 20) {
      catalogSummary += `\n... and ${catalog.length - 20} more products`;
    }
  }

  return `You are an expert email marketing planner. You create structured email plans (NOT final copy or HTML).

Brand Information:
- Name: ${brand.name}
- Website: ${brand.website}
- Voice: ${brand.voiceHints?.join(", ") || "neutral"}
- Colors: Primary ${brand.colors.primary}, Background ${brand.colors.background}, Text ${brand.colors.text}
- Fonts: Heading ${brand.fonts.heading}, Body ${brand.fonts.body}

${catalogSummary}

Campaign Intent:
- Type: ${intent.type}
- Goal: ${intent.goal}
- Audience: ${intent.audience || "general"}
- Tone: ${intent.tone}
- Urgency: ${intent.urgency}
- CTA: ${intent.cta.primary}${intent.cta.secondary ? ` / ${intent.cta.secondary}` : ""}
${intent.offer ? `- Offer: ${intent.offer.kind}${intent.offer.value ? ` (${intent.offer.value})` : ""}` : ""}

Your task is to create an EmailPlan - a structured outline/strategy for the email.

CRITICAL PRODUCT SELECTION RULES:
${
  catalog.length === 0
    ? `- The catalog is EMPTY. You MUST set "selectedProducts" to an empty array [].
- DO NOT invent product titles, prices, URLs, or any product details.
- If you need product sections, use generic guidance like "feature bestsellers" WITHOUT specific product names.
- Templates like "product_grid" or "hero_with_products" should NOT be used unless they work without actual products.`
    : `- You may select up to 8 products from the catalog above.
- Only reference products by their exact ID from the catalog.
- For each selected product, explain why it fits the campaign in "whyThisProduct".
- All productIds in sections must reference selectedProducts.`
}

REQUIRED SECTIONS:
- Must include exactly ONE "header" section
- Must include exactly ONE "footer" section

SALE INTENT VALIDATION:
${
  intent.type === "sale"
    ? `- This is a SALE campaign. You MUST include EITHER:
  * A "promo_banner" section, OR
  * Hero section with bodyGuidance mentioning the promotion (use words like: sale, off, deal, ends, limited, discount)`
    : ""
}

Return ONLY valid JSON matching this exact schema:
{
  "subject": {
    "primary": "string (max 70 chars)",
    "alternatives": ["string (max 70 chars)"] // max 3
  },
  "preheader": "string (max 110 chars)",
  "layout": {
    "template": "hero" | "hero_with_products" | "product_grid" | "editorial" | "announcement" | "newsletter" | "minimal",
    "density": "light" | "medium" | "high"
  },
  "sections": [
    {
      "id": "string (max 24 chars, slug format)",
      "type": "header" | "hero" | "value_props" | "product_feature" | "product_grid" | "social_proof" | "promo_banner" | "faq" | "footer",
      "purpose": "string (max 120 chars)",
      "headline": "string (max 60 chars, optional)",
      "bodyGuidance": "string (max 260 chars, optional)",
      "cta": { "label": "string (max 32)", "hrefHint": "string (max 120, optional)" } (optional),
      "productIds": ["string"] (max 8, optional),
      "styleHints": ["string (max 40)"] (max 6, optional)
    }
  ], // min 3 max 10
  "selectedProducts": [
    {
      "id": "string (must match catalog ID)",
      "title": "string (max 90)",
      "price": "string (max 20, optional)",
      "imageUrl": "url (optional)",
      "url": "url (optional)",
      "whyThisProduct": "string (max 120)"
    }
  ], // max 8
  "personalization": {
    "level": "none" | "light" | "medium",
    "ideas": ["string (max 80)"] // max 4
  },
  "compliance": {
    "includeUnsubscribe": true,
    "includePhysicalAddressHint": true,
    "claimsToAvoid": ["string (max 80)"] // max 6, optional
  },
  "confidence": 0.0 to 1.0,
  "rationale": "string (max 220 chars)"
}

Guidelines:
- Create 3-10 sections (including required header/footer)
- Match tone to brand voice and campaign intent
- Use section types strategically for the campaign goal
- Set confidence based on how well you can match brand + intent (0.8+ for clear match)
- Return ONLY the JSON object, no markdown, no extra text`;
}

/**
 * Build user prompt for email planning
 */
function buildUserPrompt(): string {
  return `Create a structured email plan (outline/strategy) based on the brand context and campaign intent provided above. Remember to follow all product selection rules.`;
}

/**
 * Plan email based on brand context and campaign intent
 */
export async function planEmail(args: {
  brandContext: BrandContext;
  intent: CampaignIntent;
  deps?: {
    llm?: PlanEmailLLMClient;
  };
}): Promise<EmailPlan> {
  const { brandContext, intent, deps } = args;

  // Get LLM client (dependency injection for testing)
  const llmClient = deps?.llm?.completeJson ?? defaultLLMClient;

  // Build prompts
  const systemPrompt = buildSystemPrompt(brandContext, intent);
  const userPrompt = buildUserPrompt();

  let rawOutput: string;

  try {
    // Call LLM
    rawOutput = await llmClient({
      system: systemPrompt,
      user: userPrompt,
      timeoutMs: 15000,
      temperature: 0.7,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      throw createLLMError(
        "LLM_TIMEOUT",
        LLM_ERROR_MESSAGES.LLM_TIMEOUT,
        error
      );
    }
    throw createLLMError("LLM_FAILED", LLM_ERROR_MESSAGES.LLM_FAILED, error);
  }

  // Parse JSON
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(rawOutput);
  } catch (error) {
    throw createLLMError(
      "LLM_OUTPUT_INVALID",
      "Failed to parse LLM output as JSON",
      error
    );
  }

  // Validate output with schema
  const parseResult = EmailPlanSchema.safeParse(parsedOutput);

  if (parseResult.success) {
    return parseResult.data;
  }

  // Log validation error for debugging
  console.error("[planEmail] Initial validation failed:", {
    output: parsedOutput,
    error: parseResult.error.format(),
  });

  // First validation failed - attempt repair retry
  try {
    const repairPrompt = `The previous JSON output had validation errors. Fix it to match the exact schema.

Previous output:
${JSON.stringify(parsedOutput, null, 2)}

Validation errors:
${JSON.stringify(parseResult.error.format(), null, 2)}

Remember the rules:
- Must include ONE "header" and ONE "footer" section
- All productIds must reference selectedProducts
- If selectedProducts is empty, no sections can have productIds
${
  brandContext.catalog.length === 0
    ? "- Catalog is EMPTY: selectedProducts MUST be empty array, no invented products"
    : ""
}
${
  intent.type === "sale"
    ? "- SALE intent: include promo_banner OR hero with sale mention in bodyGuidance"
    : ""
}

Return ONLY corrected valid JSON matching the schema.`;

    const repairedOutput = await llmClient({
      system: buildSystemPrompt(brandContext, intent),
      user: repairPrompt,
      timeoutMs: 15000,
      temperature: 0.3,
    });

    const repairedParsed = JSON.parse(repairedOutput);
    const repairedResult = EmailPlanSchema.safeParse(repairedParsed);

    if (repairedResult.success) {
      return repairedResult.data;
    }

    // Repair failed
    console.error("[planEmail] Repair validation failed:", {
      output: repairedParsed,
      error: repairedResult.error.format(),
    });

    throw createLLMError(
      "LLM_OUTPUT_INVALID",
      LLM_ERROR_MESSAGES.LLM_OUTPUT_INVALID,
      repairedResult.error
    );
  } catch (error) {
    // If repair itself fails, throw invalid output error
    if (error instanceof Error && error.name === "LLMError") {
      throw error;
    }
    throw createLLMError(
      "LLM_OUTPUT_INVALID",
      LLM_ERROR_MESSAGES.LLM_OUTPUT_INVALID,
      error
    );
  }
}
