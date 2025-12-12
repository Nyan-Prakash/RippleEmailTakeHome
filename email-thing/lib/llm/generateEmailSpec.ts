import type { BrandContext } from "../schemas/brand";
import type { CampaignIntent } from "../schemas/campaign";
import type { EmailPlan } from "../schemas/plan";
import type { EmailSpec } from "../schemas/emailSpec";
import { EmailSpecSchema } from "../schemas/emailSpec";
import { createLLMError } from "./errors";
import { validateEmailSpecStructure } from "../validators/emailSpec";
import type { ValidationIssue } from "../validators/emailSpec";

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
  intent: CampaignIntent;
  plan: EmailPlan;
  llmClient?: GenerateEmailSpecLLMClient;
}): Promise<{ spec: EmailSpec; warnings: ValidationIssue[] }> {
  const { brandContext, intent, plan, llmClient } = args;

  if (!llmClient) {
    throw createLLMError("LLM_CONFIG_MISSING", "LLM client is required");
  }

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

      // Structural validation
      const structuralResult = validateEmailSpecStructure({
        spec,
        brandContext,
        intent,
        plan,
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

The EmailSpec must:
1. Follow the exact JSON schema provided
2. Include all required fields
3. Use valid hex colors (e.g., #FF5733)
4. Reference only products that exist in the catalog
5. Include proper header/footer sections
6. Have at least one CTA button
7. Include {{unsubscribe}} token in footer

Generate ONLY valid JSON. Do not include explanations or markdown.`;
}

/**
 * Build user prompt with repair instructions if needed
 */
function buildUserPrompt(args: {
  brandContext: BrandContext;
  intent: CampaignIntent;
  plan: EmailPlan;
  attempt: number;
  previousSpec: string | null;
  previousErrors: string[];
}): string {
  const { brandContext, intent, plan, attempt, previousSpec, previousErrors } = args;

  let prompt = "";

  if (attempt === 1) {
    // First attempt - standard generation
    prompt = `Generate an EmailSpec for the following campaign:

BRAND CONTEXT:
${JSON.stringify(brandContext, null, 2)}

CAMPAIGN INTENT:
${JSON.stringify(intent, null, 2)}

EMAIL PLAN:
${JSON.stringify(plan, null, 2)}

REQUIREMENTS:
- Header section must be first
- Footer section must be last
- Include at least one button with non-empty text and href
- All productCard blocks must reference products in the catalog
- Footer must include {{unsubscribe}} token in a smallPrint block
- Section IDs must be unique
- Use brand colors and fonts from brand context
${intent.ctaText ? `- Primary CTA should be similar to: "${intent.ctaText}"` : ""}

Generate a complete EmailSpec JSON following the schema.`;

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
${intent.ctaText ? `- Button text should match: "${intent.ctaText}"` : ""}

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
