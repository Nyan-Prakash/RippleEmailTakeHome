import OpenAI from "openai";
import type { BrandContext } from "../schemas/brand";
import type { CampaignIntent } from "../schemas/campaign";
import type { EmailPlan } from "../schemas/plan";
import { EmailSpecSchema, type EmailSpec } from "../schemas/emailSpec";
import {
  validateEmailSpecStructure,
  type ValidationIssue,
  type ValidationResult,
} from "../validators/emailSpec";
import { createLLMError } from "./errors";

const MAX_ATTEMPTS = 3;

/**
 * LLM client interface for dependency injection
 */
export interface GenerateEmailSpecLLMClient {
  completeJson(args: {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    maxTokens: number;
    timeout?: number;
  }): Promise<string>;
}

/**
 * Default OpenAI-based LLM client
 */
function createDefaultLLMClient(): GenerateEmailSpecLLMClient {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return {
    async completeJson(args) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: args.systemPrompt },
          { role: "user", content: args.userPrompt },
        ],
        temperature: args.temperature,
        max_tokens: args.maxTokens,
        response_format: { type: "json_object" },
      });

      return response.choices[0]?.message?.content || "";
    },
  };
}

/**
 * Build system prompt for EmailSpec generation
 */
function buildSystemPrompt(args: {
  brandContext: BrandContext;
  intent: CampaignIntent;
  plan: EmailPlan;
}): string {
  const { brandContext, intent, plan } = args;
  const brand = brandContext.brand;

  // Limit products to first 20
  const productsToShow = brandContext.catalog.slice(0, 20);
  const hasMoreProducts = brandContext.catalog.length > 20;

  return `You are an expert email marketing designer. Generate a complete EmailSpec JSON for an email campaign.

# BRAND INFORMATION

**Brand Name:** ${brand.name}
**Website:** ${brand.website}
**Logo URL:** ${brand.logoUrl || "Not provided"}

**Brand Colors:**
- Primary: ${brand.colors.primary}
- Background: ${brand.colors.background}
- Text: ${brand.colors.text}

**Brand Fonts:**
- Heading: ${brand.fonts.heading}
- Body: ${brand.fonts.body}

**Voice Hints:** ${brand.voiceHints.join(", ") || "Standard professional"}

# AVAILABLE PRODUCTS

${productsToShow.length > 0 ? productsToShow.map((p) => `- **${p.title}** (ID: ${p.id}) - ${p.price} - ${p.url}`).join("\n") : "No products available"}
${hasMoreProducts ? `\n(${brandContext.catalog.length - 20} more products available but not shown)` : ""}

# CAMPAIGN INTENT

**Type:** ${intent.type}
**Tone:** ${intent.tone || "professional"}
${intent.offer ? `**Offer:** ${intent.offer}` : ""}
${intent.urgency ? `**Urgency:** ${intent.urgency}` : ""}
${intent.audience ? `**Audience:** ${intent.audience}` : ""}
${intent.ctaText ? `**Preferred CTA:** ${intent.ctaText}` : ""}
${intent.notes ? `**Notes:** ${intent.notes}` : ""}

# EMAIL PLAN

**Goal:** ${plan.goal}

**Sections:**
${plan.sections.map((s, idx) => `${idx + 1}. ${s.type}${s.variant ? ` (${s.variant})` : ""}${s.count ? ` - ${s.count} items` : ""}`).join("\n")}

# CRITICAL RULES

1. **NO HTML OR MJML** - Output only JSON matching the EmailSpec schema
2. **Use ONLY real products** from the catalog above (by ID)
3. **Required sections:** header (first), footer (last)
4. **Required blocks:** At least one button block with valid text and href
5. **Footer requirement:** Must include smallPrint block with {{unsubscribe}} token
6. **Text safety:** No < or > characters in any text field
7. **Product references:** All productCard blocks must reference existing products by ID
8. **Logo:** If brand has a logo URL, include it in header
9. **Section IDs:** Must be unique (e.g., "header-1", "hero-1", "footer-1")

# ALLOWED SECTION TYPES

header, hero, feature, productGrid, testimonial, trustBar, footer

# ALLOWED BLOCK TYPES

- logo: { type: "logo", src: string, alt: string, width?: number }
- heading: { type: "heading", text: string, level: 1|2|3, align?: "left"|"center"|"right" }
- paragraph: { type: "paragraph", text: string, align?: "left"|"center"|"right" }
- image: { type: "image", src: string, alt: string, href?: string }
- button: { type: "button", text: string, href: string, variant?: "primary"|"secondary"|"outline", align?: "left"|"center"|"right" }
- productCard: { type: "productCard", productRef: string }
- divider: { type: "divider" }
- spacer: { type: "spacer", height: number }
- smallPrint: { type: "smallPrint", text: string, align?: "left"|"center"|"right" }

# LAYOUT VARIANTS

- single: Default, one column
- twoColumn: { variant: "twoColumn", columns: [{ width: "50%", blocks: [...] }, { width: "50%", blocks: [...] }] }
- grid: { variant: "grid", columns: 2|3, gap: number }

# JSON SCHEMA STRUCTURE

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
    "primaryColor": "${brand.colors.primary}",
    "font": {
      "heading": "${brand.fonts.heading}",
      "body": "${brand.fonts.body}"
    },
    "button": {
      "radius": 8,
      "style": "solid"
    }
  },
  "sections": [
    {
      "id": "header-1",
      "type": "header",
      "blocks": [
        { "type": "logo", "src": "${brand.logoUrl || ""}", "alt": "${brand.name}" }
      ]
    },
    // ... more sections based on plan
    {
      "id": "footer-1",
      "type": "footer",
      "blocks": [
        { "type": "smallPrint", "text": "{{unsubscribe}}", "align": "center" }
      ]
    }
  ],
  "catalog": {
    "items": [] // Include only products referenced in productCard blocks
  }
}

Generate the complete EmailSpec JSON now. Be creative with copy but stay true to the brand voice.`;
}

/**
 * Build user prompt
 */
function buildUserPrompt(): string {
  return "Generate the canonical EmailSpec JSON based on the brand context, campaign intent, and email plan provided above. Remember: output JSON only, no HTML or MJML.";
}

/**
 * Build repair prompt with validation errors
 */
function buildRepairPrompt(args: {
  previousJson: string;
  validationResult: ValidationResult;
  zodError?: string;
  attemptNumber: number;
}): string {
  const { previousJson, validationResult, zodError, attemptNumber } = args;

  const errorList = validationResult.issues
    .filter((i) => i.severity === "error")
    .map(
      (i, idx) =>
        `${idx + 1}. [${i.code}] ${i.message}${i.path ? ` (at ${i.path})` : ""}`
    )
    .join("\n");

  const directiveLevel =
    attemptNumber === 2
      ? "Be more careful with the schema requirements."
      : attemptNumber >= 3
        ? "THIS IS THE FINAL ATTEMPT. Fix ALL listed errors precisely. Do NOT add new sections or invent products."
        : "";

  return `The previous EmailSpec JSON had validation errors. Please fix them and return the corrected JSON.

# VALIDATION ERRORS

${errorList}

${zodError ? `# ZOD SCHEMA ERRORS\n\n${zodError}\n` : ""}

# PREVIOUS JSON (with errors)

${previousJson}

# CRITICAL REMINDERS

1. **Header must be the FIRST section**
2. **Footer must be the LAST section**
3. **Footer must include smallPrint with {{unsubscribe}} token**
4. **At least one button block required (outside footer)**
5. **All productCard blocks must reference products in the catalog**
6. **All section IDs must be unique**
7. **Logo blocks must have valid src URLs**
8. **Do NOT add new sections beyond the plan**
9. **Do NOT invent products that don't exist in the catalog**

${directiveLevel}

Return ONLY the corrected JSON, nothing else.`;
}

/**
 * Generate EmailSpec with multi-attempt repair loop
 */
export async function generateEmailSpec(args: {
  brandContext: BrandContext;
  intent: CampaignIntent;
  plan: EmailPlan;
  deps?: {
    llm?: GenerateEmailSpecLLMClient;
  };
}): Promise<{ spec: EmailSpec; warnings: ValidationIssue[] }> {
  const { brandContext, intent, plan, deps } = args;
  const llm = deps?.llm || createDefaultLLMClient();

  const systemPrompt = buildSystemPrompt({ brandContext, intent, plan });
  const userPrompt = buildUserPrompt();

  let attemptNumber = 1;
  let lastJson = "";
  let lastValidationResult: ValidationResult | null = null;
  const seenErrors = new Set<string>();

  // Temperature decreases with each attempt
  const temperatures = [0.7, 0.5, 0.3];

  while (attemptNumber <= MAX_ATTEMPTS) {
    try {
      // Generate or repair
      const prompt =
        attemptNumber === 1
          ? userPrompt
          : buildRepairPrompt({
              previousJson: lastJson,
              validationResult: lastValidationResult!,
              attemptNumber,
            });

      const temperature = temperatures[attemptNumber - 1] || 0.3;

      console.log(
        `[generateEmailSpec] Attempt ${attemptNumber}/${MAX_ATTEMPTS} (temp=${temperature})`
      );

      const rawOutput = await llm.completeJson({
        systemPrompt: attemptNumber === 1 ? systemPrompt : systemPrompt,
        userPrompt: prompt,
        temperature,
        maxTokens: 3000,
        timeout: 15000,
      });

      lastJson = rawOutput;

      // Parse JSON
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawOutput);
      } catch (parseError) {
        console.error(
          `[generateEmailSpec] JSON parse error on attempt ${attemptNumber}:`,
          parseError
        );
        throw createLLMError(
          "LLM_OUTPUT_INVALID",
          `Invalid JSON output: ${parseError instanceof Error ? parseError.message : "unknown error"}`
        );
      }

      // Validate with Zod
      const zodResult = EmailSpecSchema.safeParse(parsedJson);

      if (!zodResult.success) {
        console.error(
          `[generateEmailSpec] Zod validation failed on attempt ${attemptNumber}:`,
          zodResult.error.format()
        );

        const zodErrorMsg = JSON.stringify(zodResult.error.format(), null, 2);

        lastValidationResult = {
          ok: false,
          issues: [
            {
              code: "ZOD_VALIDATION_FAILED",
              severity: "error",
              message: zodErrorMsg,
            },
          ],
        };

        attemptNumber++;
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

      lastValidationResult = structuralResult;

      // Check for blocking errors
      const blockingErrors = structuralResult.issues.filter(
        (i) => i.severity === "error"
      );

      if (blockingErrors.length === 0) {
        // Success! Return spec with warnings
        const warnings = structuralResult.issues.filter(
          (i) => i.severity === "warning"
        );
        console.log(
          `[generateEmailSpec] Success on attempt ${attemptNumber} with ${warnings.length} warnings`
        );
        return { spec, warnings };
      }

      // Check for repeated errors (convergence failure)
      const errorSignature = blockingErrors
        .map((e) => e.code)
        .sort()
        .join(",");
      if (seenErrors.has(errorSignature)) {
        console.error(
          `[generateEmailSpec] Same errors repeated, convergence failed:`,
          errorSignature
        );
        throw createLLMError(
          "LLM_OUTPUT_INVALID",
          `Repair failed: same errors repeated after ${attemptNumber} attempts`
        );
      }
      seenErrors.add(errorSignature);

      console.log(
        `[generateEmailSpec] Attempt ${attemptNumber} had ${blockingErrors.length} blocking errors:`,
        blockingErrors.map((e) => e.code).join(", ")
      );

      attemptNumber++;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("LLM_OUTPUT_INVALID") ||
          error.message.includes("LLM_TIMEOUT"))
      ) {
        throw error;
      }

      console.error(
        `[generateEmailSpec] Unexpected error on attempt ${attemptNumber}:`,
        error
      );
      throw createLLMError(
        "LLM_FAILED",
        `Unexpected error during generation: ${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  // Max attempts exhausted
  console.error(`[generateEmailSpec] Max attempts (${MAX_ATTEMPTS}) exhausted`);
  throw createLLMError(
    "LLM_OUTPUT_INVALID",
    `Failed to generate valid EmailSpec after ${MAX_ATTEMPTS} attempts`
  );
}
