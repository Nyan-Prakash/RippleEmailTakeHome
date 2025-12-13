import type { BrandContext } from "../schemas/brand";
import type { CampaignIntent as LLMCampaignIntent } from "./schemas/campaignIntent";
import type { EmailPlan as LLMEmailPlan } from "./schemas/emailPlan";
import type { CampaignIntent as APICampaignIntent } from "../schemas/campaign";
import type { EmailPlan as APIEmailPlan } from "../schemas/plan";
import type { EmailSpec } from "../schemas/emailSpec";
import { EmailSpecSchema } from "../schemas/emailSpec";
import { createLLMError } from "./errors";
import { validateEmailSpecStructure } from "../validators/emailSpec";
import type { ValidationIssue } from "../validators/emailSpec";
import {
  normalizeCampaignIntent,
  normalizeEmailPlan,
} from "../normalize/llmToApiSchemas";

const MAX_ATTEMPTS = 3;

/**
 * LLM client interface for dependency injection
 */
export interface GenerateEmailSpecLLMClient {
  chat: {
    completions: {
      create: (params: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        temperature: number;
        max_tokens: number;
        response_format: { type: string };
      }) => Promise<{
        choices: Array<{
          message: {
            content: string | null;
          };
        }>;
      }>;
    };
  };
}

/**
 * Generate EmailSpec from brand context, intent, and plan
 * 
 * Uses a multi-attempt repair loop:
 * - Attempt 1: temperature 0.7, Zod errors only
 * - Attempt 2: temperature 0.5, Zod + structural errors
 * - Attempt 3: temperature 0.3, Zod + structural + explicit fix instructions
 * 
 * @param args - Generation arguments
 * @returns EmailSpec and warnings
 */
export async function generateEmailSpec(args: {
  brandContext: BrandContext;
  intent: LLMCampaignIntent;
  plan: LLMEmailPlan;
  llmClient?: GenerateEmailSpecLLMClient;
}): Promise<{ spec: EmailSpec; warnings: ValidationIssue[] }> {
  const { brandContext, intent, plan, llmClient } = args;

  if (!llmClient) {
    throw createLLMError("LLM_CONFIG_MISSING", "LLM client is required");
  }

  // Normalize LLM schemas to API schemas for validation
  const normalizedIntent = normalizeCampaignIntent(intent);
  const normalizedPlan = normalizeEmailPlan(plan, intent);

  let previousSpec: string | null = null;
  let previousErrors: string[] = [];
  const errorHistory = new Set<string>();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const temperature = getTemperatureForAttempt(attempt);
    
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({
      brandContext,
      intent,
      plan,
      attempt,
      previousSpec,
      previousErrors,
    });

    try {
      const response = await llmClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw createLLMError("LLM_OUTPUT_INVALID", "LLM returned empty response");
      }

      // Parse JSON
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch (parseError) {
        previousSpec = content;
        previousErrors = [`Invalid JSON: ${(parseError as Error).message}`];
        
        if (attempt === MAX_ATTEMPTS) {
          throw createLLMError(
            "LLM_OUTPUT_INVALID",
            `Failed to parse JSON after ${MAX_ATTEMPTS} attempts`,
            parseError
          );
        }
        continue;
      }

      // Validate with Zod schema
      const zodResult = EmailSpecSchema.safeParse(parsedJson);
      
      if (!zodResult.success) {
        const zodErrors = zodResult.error.issues.map(
          (err) => `${err.path.join(".")}: ${err.message}`
        );
        
        previousSpec = content;
        previousErrors = zodErrors;
        
        // Check for repeated errors
        const errorSignature = zodErrors.join("|");
        if (errorHistory.has(errorSignature)) {
          throw createLLMError(
            "LLM_OUTPUT_INVALID",
            `Same validation errors appeared multiple times: ${zodErrors.join("; ")}`
          );
        }
        errorHistory.add(errorSignature);
        
        if (attempt === MAX_ATTEMPTS) {
          throw createLLMError(
            "LLM_OUTPUT_INVALID",
            `Zod validation failed after ${MAX_ATTEMPTS} attempts: ${zodErrors.join("; ")}`
          );
        }
        continue;
      }

      const spec = zodResult.data;

      // Structural validation (use normalized schemas)
      const structuralResult = validateEmailSpecStructure({
        spec,
        brandContext,
        intent: normalizedIntent,
        plan: normalizedPlan,
      });

      const blockingErrors = structuralResult.issues.filter(i => i.severity === "error");
      const warnings = structuralResult.issues.filter(i => i.severity === "warning");

      if (blockingErrors.length > 0) {
        const errorMessages = blockingErrors.map(
          issue => `[${issue.code}] ${issue.message}${issue.path ? ` (${issue.path})` : ""}`
        );
        
        previousSpec = content;
        previousErrors = errorMessages;
        
        if (attempt === MAX_ATTEMPTS) {
          throw createLLMError(
            "LLM_OUTPUT_INVALID",
            `Structural validation failed after ${MAX_ATTEMPTS} attempts: ${errorMessages.join("; ")}`
          );
        }
        
        // Check for repeated structural errors (allow one retry per unique error)
        const errorSignature = blockingErrors.map(e => e.code).join("|");
        if (errorHistory.has(errorSignature)) {
          throw createLLMError(
            "LLM_OUTPUT_INVALID",
            `Same structural errors appeared multiple times: ${errorMessages.join("; ")}`
          );
        }
        errorHistory.add(errorSignature);
        
        continue;
      }

      // Success! Return spec with warnings
      return { spec, warnings };

    } catch (error) {
      if (error instanceof Error && error.name === "LLMError") {
        throw error;
      }
      
      // Check for timeout errors (OpenAI SDK throws various timeout-related errors)
      if (
        error instanceof Error &&
        (error.message.includes("timeout") ||
          error.message.includes("timed out") ||
          error.name === "TimeoutError" ||
          error.name === "APIConnectionTimeoutError")
      ) {
        throw createLLMError(
          "LLM_TIMEOUT",
          "LLM request timed out",
          error
        );
      }
      
      if (attempt === MAX_ATTEMPTS) {
        throw createLLMError(
          "LLM_FAILED",
          `Failed to generate EmailSpec after ${MAX_ATTEMPTS} attempts`,
          error
        );
      }
      
      // Continue to next attempt
      previousErrors = [`Request failed: ${(error as Error).message}`];
    }
  }

  throw createLLMError(
    "LLM_OUTPUT_INVALID",
    "Failed to generate valid EmailSpec after all attempts"
  );
}

/**
 * Get temperature for attempt number
 */
function getTemperatureForAttempt(attempt: number): number {
  switch (attempt) {
    case 1:
      return 0.7;
    case 2:
      return 0.5;
    case 3:
      return 0.3;
    default:
      return 0.3;
  }
}

/**
 * Build system prompt
 */
function buildSystemPrompt(): string {
  return `You are an expert email marketing designer and copywriter.

Your task is to generate a complete EmailSpec JSON that defines the structure, content, and styling of a marketing email.

REQUIRED EMAILSPEC STRUCTURE:
{
  "meta": {
    "subject": "string (5-70 chars)",
    "preheader": "string (10-140 chars)"
  },
  "theme": {
    "containerWidth": number (typically 600),
    "backgroundColor": "hex color",
    "surfaceColor": "hex color",
    "textColor": "hex color",
    "mutedTextColor": "hex color",
    "primaryColor": "hex color",
    "font": { "heading": "string", "body": "string" },
    "button": { "radius": number, "style": "solid" | "outline" }
  },
  "sections": [
    {
      "id": "unique-string",
      "type": "header" | "hero" | "feature" | "productGrid" | "testimonial" | "trustBar" | "footer",
      "background": "brand" | "surface" | "transparent",
      "padding": "none" | "small" | "medium" | "large",
      
      // FOR SINGLE COLUMN (default):
      "blocks": [ /* blocks go here */ ],
      
      // FOR TWO COLUMNS:
      "layout": {
        "variant": "twoColumn",
        "columns": [
          { "width": "50%", "blocks": [ /* left column blocks */ ] },
          { "width": "50%", "blocks": [ /* right column blocks */ ] }
        ]
      },
      "blocks": [],  // MUST be empty array when using columns!
      
      // FOR GRID:
      "layout": {
        "variant": "grid",
        "columns": 3,
        "gap": 12
      },
      "blocks": [ /* blocks distributed across grid */ ]
    }
  ],
  
BLOCK TYPES:
  { "type": "logo", "src": "url", "alt": "text", "href": "url" }
  { "type": "heading", "text": "string", "level": 1-6 }
  { "type": "paragraph", "text": "string" }
  { "type": "image", "src": "url", "alt": "text", "href": "url" }
  { "type": "button", "text": "string", "href": "url", "style": "primary"|"secondary" }
  { "type": "productCard", "productRef": "catalog-product-id" }
  { "type": "divider" }
  { "type": "spacer", "height": number }
  { "type": "smallPrint", "text": "string (must include {{unsubscribe}} in footer)" }
  ],
  "catalog": { "items": [...products from brand context...] }
}

CRITICAL RULES:
1. "meta" object is REQUIRED with subject and preheader
2. "sections" array is REQUIRED with at least 3 sections (header, body section, footer)
3. First section must be type="header", last section must be type="footer"
4. Footer MUST contain a smallPrint block with {{unsubscribe}} token
5. Use brand colors and fonts from the provided brand context
6. All productCard blocks must reference products from the catalog by ID
7. All section IDs must be unique
8. Include at least one button with text and href
9. LAYOUT RULES:
   - Single column (default): Put blocks in section.blocks array
   - Two columns: Put blocks in layout.columns[0].blocks and layout.columns[1].blocks, set section.blocks to []
   - Grid: Put blocks in section.blocks array (renderer will distribute them)

Generate ONLY valid JSON matching this structure. No markdown, no explanations.`;
}

/**
 * Build user prompt with repair instructions if needed
 */
function buildUserPrompt(args: {
  brandContext: BrandContext;
  intent: LLMCampaignIntent;
  plan: LLMEmailPlan;
  attempt: number;
  previousSpec: string | null;
  previousErrors: string[];
}): string {
  const { brandContext, intent, plan, attempt, previousSpec, previousErrors } = args;

  let prompt = "";

  if (attempt === 1) {
    // First attempt - standard generation
    prompt = `Transform the following EMAIL PLAN into a complete EmailSpec JSON with actual email content.

The EmailPlan provides high-level structure and guidance. You must:
1. Convert plan sections into EmailSpec sections with actual blocks (logo, heading, paragraph, button, etc.)
2. Write compelling copy based on the plan's guidance (headline, body, CTAs)
3. Use the plan's subject as meta.subject and create a preheader
4. Apply brand colors/fonts to theme
5. Convert plan's selectedProducts into catalog items and reference them in productCard blocks

BRAND CONTEXT (colors, fonts, products, voice):
${JSON.stringify(brandContext, null, 2)}

CAMPAIGN INTENT (goal, tone, CTA):
${JSON.stringify(intent, null, 2)}

EMAIL PLAN (structure to transform):
${JSON.stringify(plan, null, 2)}

TRANSFORM INTO EMAILSPEC WITH:
- meta: { subject: "${plan.subject.primary}", preheader: "..." }
- theme: { containerWidth: 600, colors from brand, fonts from brand, button style }
- sections: array of ${plan.sections.length} sections matching plan types, each with blocks containing actual copy
- catalog: { items: products from brandContext.catalog }

REQUIREMENTS:
- First section must be type="header" with logo block
- Last section must be type="footer" with smallPrint block containing "{{unsubscribe}}"
- Write actual email copy in heading/paragraph blocks based on plan guidance
- Include at least one button block with text and href
- Use plan.sections[].productIds to add productCard blocks referencing catalog items
${intent.cta?.primary ? `- Primary CTA text should be similar to: "${intent.cta.primary}"` : ""}

Generate ONLY the EmailSpec JSON.`;

  } else {
    // Repair attempt
    prompt = `The previous EmailSpec had validation errors. Please fix them.

PREVIOUS SPEC (INVALID):
${previousSpec || "N/A"}

VALIDATION ERRORS:
${previousErrors.map((err, i) => `${i + 1}. ${err}`).join("\n")}

BRAND CONTEXT:
${JSON.stringify(brandContext, null, 2)}

CAMPAIGN INTENT:
${JSON.stringify(intent, null, 2)}

EMAIL PLAN:
${JSON.stringify(plan, null, 2)}

CRITICAL REPAIR INSTRUCTIONS (Attempt ${attempt}/${MAX_ATTEMPTS}):
- Do NOT add new sections beyond what the plan specifies
- Do NOT invent products that aren't in the catalog
- Fix ONLY the errors listed above
- Maintain the overall structure from the previous attempt
- Ensure header is first section, footer is last section
- Include at least one button with valid text and href
- Footer must have {{unsubscribe}} token in smallPrint block
- All section IDs must be unique
- All productCard blocks must reference catalog items
${intent.cta?.primary ? `- Button text should match: "${intent.cta.primary}"` : ""}

${attempt === 3 ? `FINAL ATTEMPT - Be extra careful:
- Double-check every product reference exists in catalog
- Verify header is sections[0] and footer is sections[last]
- Confirm button has both text and href properties
- Verify all colors are valid hex codes
- Check that all required schema fields are present` : ""}

Generate the corrected EmailSpec JSON.`;
  }

  return prompt;
}
