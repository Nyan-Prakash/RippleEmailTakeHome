import type { BrandContext } from "../schemas/brand";
import type { CampaignIntent } from "./schemas/campaignIntent";
import type { EmailPlan } from "./schemas/emailPlan";
import { EmailSpecSchema, type EmailSpec } from "../schemas/emailSpec";
import { createLLMError, LLM_ERROR_MESSAGES } from "./errors";

/**
 * LLM client interface for dependency injection
 */
export interface GenerateEmailSpecLLMClient {
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
    max_tokens: 3000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw createLLMError("LLM_FAILED", LLM_ERROR_MESSAGES.LLM_FAILED);
  }

  return content;
}

/**
 * Build system prompt for email spec generation
 */
function buildSystemPrompt(
  brandContext: BrandContext,
  intent: CampaignIntent,
  plan: EmailPlan
): string {
  const { brand, catalog } = brandContext;

  // Build catalog summary
  let catalogSummary = "No products in catalog.";
  if (catalog.length > 0) {
    catalogSummary = `${catalog.length} products available:\n`;
    catalogSummary += catalog
      .slice(0, 20)
      .map((p) => `- ID: ${p.id}, Title: ${p.title}, Price: ${p.price}`)
      .join("\n");
    if (catalog.length > 20) {
      catalogSummary += `\n... and ${catalog.length - 20} more products`;
    }
  }

  // Build plan sections summary
  const planSections = plan.sections
    .map(
      (s) =>
        `- ${s.type}: ${s.purpose}${s.headline ? ` ("${s.headline}")` : ""}`
    )
    .join("\n");

  return `You are an expert email spec generator. You create canonical, renderer-ready JSON specifications for emails.

CRITICAL: You output ONLY EmailSpec JSON - NO HTML, NO MJML, NO markup of any kind.

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
- Tone: ${intent.tone}
- CTA: ${intent.cta.primary}

Email Plan Structure:
Subject: ${plan.subject.primary}
Preheader: ${plan.preheader}
Template: ${plan.layout.template}

Sections:
${planSections}

Selected Products: ${plan.selectedProducts.length} products

CRITICAL RULES:
1. NO HTML/MJML: Output only JSON. Text fields must NOT contain HTML tags.
2. REAL PRODUCTS ONLY: Use only products from the catalog above. DO NOT invent products.
3. ALLOWED SECTION TYPES: "header", "hero", "feature", "productGrid", "testimonial", "trustBar", "footer"
4. ALLOWED BLOCK TYPES: "logo", "heading", "paragraph", "image", "button", "productCard", "divider", "spacer", "smallPrint"
5. REQUIRED: Must include ONE "header" section and ONE "footer" section
6. REQUIRED: Must include at least ONE "button" block somewhere (for CTA)
7. PRODUCT CARDS: Use "productCard" blocks only if catalog has products. Each productRef must match a catalog item ID.
8. TEXT SAFETY: Block text fields must not contain < or > characters

Return ONLY valid JSON matching this exact schema:

{
  "meta": {
    "subject": "string (5-150 chars)",
    "preheader": "string (10-200 chars)"
  },
  "theme": {
    "containerWidth": 600,
    "backgroundColor": "#FFFFFF",
    "surfaceColor": "#F5F5F5",
    "textColor": "#111111",
    "mutedTextColor": "#666666",
    "primaryColor": "#111111",
    "font": {
      "heading": "string",
      "body": "string"
    },
    "button": {
      "radius": 8,
      "style": "solid" | "outline"
    }
  },
  "sections": [
    {
      "id": "string (unique)",
      "type": "header" | "hero" | "feature" | "productGrid" | "testimonial" | "trustBar" | "footer",
      "layout": {
        "variant": "single" | "twoColumn" | "grid"
      },
      "blocks": [
        { "type": "logo", "src": "url", "href": "url (optional)", "align": "left" | "center" },
        { "type": "heading", "text": "string (no HTML)", "level": 1 | 2 | 3, "align": "left" | "center" },
        { "type": "paragraph", "text": "string (no HTML)", "align": "left" | "center" },
        { "type": "image", "src": "url", "alt": "string", "href": "url (optional)" },
        { "type": "button", "text": "string", "href": "url", "align": "left" | "center" },
        { "type": "productCard", "productRef": "catalog product ID" },
        { "type": "divider" },
        { "type": "spacer", "size": 4-64 },
        { "type": "smallPrint", "text": "string (no HTML)" }
      ],
      "style": {
        "paddingX": 0-64,
        "paddingY": 0-64,
        "background": "brand" | "surface" | "transparent"
      }
    }
  ], // min 3 max 10
  "catalog": {
    "items": [
      {
        "id": "string",
        "title": "string",
        "price": "string",
        "image": "url",
        "url": "url"
      }
    ]
  }
}

Guidelines:
- Use subject/preheader from plan
- Create 3-10 sections matching the plan structure
- Use brand colors/fonts in theme
- Map plan sections to spec sections (maintain intent and structure)
- For productCard blocks, use selectedProducts from plan
- Ensure text is clean (no HTML tags)
- Return ONLY the JSON object, no markdown, no extra text`;
}

/**
 * Build user prompt for email spec generation
 */
function buildUserPrompt(): string {
  return `Generate the canonical EmailSpec JSON based on the brand context, campaign intent, and email plan provided above. Remember: output JSON only, no HTML or MJML.`;
}

/**
 * Generate EmailSpec from brand context, intent, and plan
 */
export async function generateEmailSpec(args: {
  brandContext: BrandContext;
  intent: CampaignIntent;
  plan: EmailPlan;
  deps?: {
    llm?: GenerateEmailSpecLLMClient;
  };
}): Promise<EmailSpec> {
  const { brandContext, intent, plan, deps } = args;

  // Get LLM client (dependency injection for testing)
  const llmClient = deps?.llm?.completeJson ?? defaultLLMClient;

  // Build prompts
  const systemPrompt = buildSystemPrompt(brandContext, intent, plan);
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
  const parseResult = EmailSpecSchema.safeParse(parsedOutput);

  if (parseResult.success) {
    return parseResult.data;
  }

  // Log validation error for debugging
  console.error("[generateEmailSpec] Initial validation failed:", {
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

Remember the critical rules:
- Must include ONE "header" and ONE "footer" section
- Must include at least ONE "button" block
- All productCard productRef values must match catalog item IDs
${
  brandContext.catalog.length === 0
    ? "- Catalog is EMPTY: NO productCard blocks allowed"
    : ""
}
- NO HTML in text fields (no < or > characters)
- Only use allowed section types: header, hero, feature, productGrid, testimonial, trustBar, footer
- Only use allowed block types: logo, heading, paragraph, image, button, productCard, divider, spacer, smallPrint

Return ONLY corrected valid JSON matching the EmailSpec schema.`;

    const repairedOutput = await llmClient({
      system: buildSystemPrompt(brandContext, intent, plan),
      user: repairPrompt,
      timeoutMs: 15000,
      temperature: 0.3,
    });

    const repairedParsed = JSON.parse(repairedOutput);
    const repairedResult = EmailSpecSchema.safeParse(repairedParsed);

    if (repairedResult.success) {
      return repairedResult.data;
    }

    // Repair failed
    console.error("[generateEmailSpec] Repair validation failed:", {
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
