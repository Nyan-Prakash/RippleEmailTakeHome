import OpenAI from "openai";
import type { BrandContext } from "../types";
import {
  CampaignIntentSchema,
  type CampaignIntent,
} from "./schemas/campaignIntent";
import { createLLMError, LLM_ERROR_MESSAGES } from "./errors";

/**
 * LLM client interface for dependency injection
 */
export interface LLMClient {
  generateJSON(params: {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<unknown>;
}

/**
 * OpenAI adapter implementing LLMClient interface
 */
export class OpenAIClient implements LLMClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateJSON(params: {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<unknown> {
    const response = await this.client.chat.completions.create({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw createLLMError("LLM_FAILED", "No response from LLM");
    }

    return JSON.parse(content);
  }
}

/**
 * Build system prompt for campaign intent parsing
 */
function buildSystemPrompt(brandContext: BrandContext): string {
  const { brand, catalog, trust } = brandContext;

  return `You are a campaign intent parser for email marketing.

Brand Information:
- Name: ${brand.name}
- Website: ${brand.website}
- Voice: ${brand.voiceHints?.join(", ") || "not specified"}
- Products: ${catalog.length} items in catalog
- Trust signals: ${Object.keys(trust).length} available

Your job is to parse user prompts into structured campaign intent.

Return ONLY valid JSON matching this exact schema:
{
  "type": "sale" | "product_launch" | "back_in_stock" | "newsletter" | "holiday" | "winback" | "announcement" | "other",
  "goal": "string (max 120 chars)",
  "audience": "string (max 80 chars, optional)",
  "offer": {
    "kind": "percent" | "fixed_amount" | "free_shipping" | "bogo" | "none" | "other",
    "value": number (optional),
    "details": "string (max 80 chars, optional)"
  } (optional),
  "urgency": "low" | "medium" | "high",
  "timeWindow": {
    "start": "ISO datetime (optional)",
    "end": "ISO datetime (optional)"
  } (optional),
  "tone": "playful" | "premium" | "minimal" | "bold" | "friendly" | "urgent" | "informative" | "other",
  "cta": {
    "primary": "string (max 40 chars)",
    "secondary": "string (max 40 chars, optional)"
  },
  "constraints": ["string"] (max 6 items, optional),
  "keywords": ["string"] (max 12 items),
  "confidence": 0.0 to 1.0,
  "rationale": "string (max 200 chars)"
}

REQUIRED fields (must always be present):
- type
- goal
- urgency
- tone
- cta (with at least "primary")
- keywords (array with at least 1 item)
- confidence (number between 0 and 1)
- rationale

OPTIONAL fields:
- audience
- offer
- timeWindow
- cta.secondary
- constraints

Example output for "50% off sale ending tonight":
{
  "type": "sale",
  "goal": "Drive urgency for limited-time discount",
  "urgency": "high",
  "tone": "urgent",
  "cta": {
    "primary": "Shop Now"
  },
  "offer": {
    "kind": "percent",
    "value": 50
  },
  "timeWindow": {
    "end": "2024-12-13T23:59:59Z"
  },
  "keywords": ["sale", "discount", "urgent", "tonight"],
  "confidence": 0.95,
  "rationale": "Clear sale with specific discount and time urgency"
}

Guidelines:
- Match tone to brand voice hints when possible
- Set confidence based on prompt clarity (0.8+ for clear, 0.5-0.7 for vague)
- Return ONLY the JSON object, no markdown, no extra text`;
}

/**
 * Build user prompt
 */
function buildUserPrompt(prompt: string): string {
  return `Parse this campaign request into structured intent:

"${prompt}"`;
}

/**
 * Parse campaign intent from user prompt using LLM
 */
export async function parseCampaignIntent(
  args: {
    brandContext: BrandContext;
    prompt: string;
  },
  deps?: {
    llmClient?: LLMClient;
    apiKey?: string;
  }
): Promise<CampaignIntent> {
  const { brandContext, prompt } = args;

  // Validate prompt
  if (!prompt || prompt.trim().length === 0) {
    throw createLLMError("INVALID_PROMPT", LLM_ERROR_MESSAGES.INVALID_PROMPT);
  }

  // Get API key from deps or environment
  const apiKey = deps?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw createLLMError(
      "LLM_CONFIG_MISSING",
      LLM_ERROR_MESSAGES.LLM_CONFIG_MISSING
    );
  }

  // Create LLM client (dependency injection for testing)
  const llmClient = deps?.llmClient ?? new OpenAIClient(apiKey);

  // Build prompts
  const systemPrompt = buildSystemPrompt(brandContext);
  const userPrompt = buildUserPrompt(prompt);

  let rawOutput: unknown;

  try {
    // Call LLM
    rawOutput = await llmClient.generateJSON({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 1000,
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

  // Validate output with schema
  const parseResult = CampaignIntentSchema.safeParse(rawOutput);

  if (parseResult.success) {
    return parseResult.data;
  }

  // Log validation error for debugging
  console.error("[parseCampaignIntent] Initial validation failed:", {
    output: rawOutput,
    error: parseResult.error.message,
  });

  // First validation failed - attempt repair retry
  try {
    const repairPrompt = `The previous JSON output had validation errors. Fix it to match the exact schema.

Previous output:
${JSON.stringify(rawOutput, null, 2)}

Validation errors:
${parseResult.error.message}

Return ONLY corrected valid JSON matching the schema.`;

    const repairedOutput = await llmClient.generateJSON({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildSystemPrompt(brandContext) },
        { role: "user", content: repairPrompt },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    const repairedResult = CampaignIntentSchema.safeParse(repairedOutput);

    if (repairedResult.success) {
      return repairedResult.data;
    }

    // Repair failed
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
