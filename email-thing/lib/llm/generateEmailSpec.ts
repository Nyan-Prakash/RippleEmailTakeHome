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
import { enhanceThemeWithAccessibleColors } from "../theme/deriveTheme";

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
  console.log(`[generateEmailSpec] ========== STARTING EMAIL SPEC GENERATION ==========`);
  const { brandContext, intent, plan, llmClient } = args;

  if (!llmClient) {
    console.error(`[generateEmailSpec] No LLM client provided`);
    throw createLLMError("LLM_CONFIG_MISSING", "LLM client is required");
  }

  console.log(`[generateEmailSpec] Brand: ${brandContext.brand?.name || 'Unknown'}`);
  console.log(`[generateEmailSpec] Intent type: ${intent.type}`);
  console.log(`[generateEmailSpec] Plan has ${plan.sections?.length || 0} sections`);

  // Normalize LLM schemas to API schemas for validation
  console.log(`[generateEmailSpec] Normalizing schemas...`);
  const normalizedIntent = normalizeCampaignIntent(intent);
  const normalizedPlan = normalizeEmailPlan(plan, intent);
  console.log(`[generateEmailSpec] Schemas normalized successfully`);

  let previousSpec: string | null = null;
  let previousErrors: string[] = [];
  const errorHistory = new Set<string>();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[generateEmailSpec] Starting attempt ${attempt}/${MAX_ATTEMPTS}`);
    const temperature = getTemperatureForAttempt(attempt);
    
    console.log(`[generateEmailSpec] Building prompts for attempt ${attempt}`);
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({
      brandContext,
      intent,
      plan,
      attempt,
      previousSpec,
      previousErrors,
    });

    console.log(`[generateEmailSpec] Calling LLM with temperature ${temperature}`);
    try {
      const response = await llmClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: 4500, // Increased for larger specs with 7-12 sections
        response_format: { type: "json_object" },
      });

      console.log(`[generateEmailSpec] LLM response received, attempt ${attempt}`);
      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error(`[generateEmailSpec] Empty LLM response on attempt ${attempt}`);
        throw createLLMError("LLM_OUTPUT_INVALID", "LLM returned empty response");
      }

      console.log(`[generateEmailSpec] Parsing JSON response (length: ${content.length})`);
      // Parse JSON
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
        console.log(`[generateEmailSpec] JSON parsed successfully`);
      } catch (parseError) {
        console.error(`[generateEmailSpec] JSON parse error on attempt ${attempt}:`, (parseError as Error).message);
        console.error(`[generateEmailSpec] First 200 chars of content:`, content.substring(0, 200));
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
      console.log(`[generateEmailSpec] Validating with Zod schema`);
      const zodResult = EmailSpecSchema.safeParse(parsedJson);
      
      if (!zodResult.success) {
        const zodErrors = zodResult.error.issues.map(
          (err) => `${err.path.join(".")}: ${err.message}`
        );
        
        console.warn(`[generateEmailSpec] Zod validation failed on attempt ${attempt}:`);
        zodErrors.forEach((err, i) => console.warn(`  ${i + 1}. ${err}`));
        
        previousSpec = content;
        previousErrors = zodErrors;
        
        // Check for repeated errors
        const errorSignature = zodErrors.join("|");
        if (errorHistory.has(errorSignature)) {
          console.error(`[generateEmailSpec] Repeated error detected:`, errorSignature);
          throw createLLMError(
            "LLM_OUTPUT_INVALID",
            `Same validation errors appeared multiple times: ${zodErrors.join("; ")}`
          );
        }
        errorHistory.add(errorSignature);
        console.log(`[generateEmailSpec] Error signature added to history. Total unique errors: ${errorHistory.size}`);
        
        if (attempt === MAX_ATTEMPTS) {
          throw createLLMError(
            "LLM_OUTPUT_INVALID",
            `Zod validation failed after ${MAX_ATTEMPTS} attempts: ${zodErrors.join("; ")}`
          );
        }
        continue;
      }

      console.log(`[generateEmailSpec] Zod validation passed`);
      const spec = zodResult.data;

      // Structural validation (use normalized schemas)
      console.log(`[generateEmailSpec] Running structural validation`);
      const structuralResult = validateEmailSpecStructure({
        spec,
        brandContext,
        intent: normalizedIntent,
        plan: normalizedPlan,
      });

      const blockingErrors = structuralResult.issues.filter(i => i.severity === "error");
      const warnings = structuralResult.issues.filter(i => i.severity === "warning");
      
      console.log(`[generateEmailSpec] Structural validation complete: ${blockingErrors.length} errors, ${warnings.length} warnings`);

      if (blockingErrors.length > 0) {
        const errorMessages = blockingErrors.map(
          issue => `[${issue.code}] ${issue.message}${issue.path ? ` (${issue.path})` : ""}`
        );
        
        console.warn(`[generateEmailSpec] Structural errors on attempt ${attempt}:`);
        errorMessages.forEach((err, i) => console.warn(`  ${i + 1}. ${err}`));
        
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
          console.error(`[generateEmailSpec] Repeated structural error detected:`, errorSignature);
          throw createLLMError(
            "LLM_OUTPUT_INVALID",
            `Same structural errors appeared multiple times: ${errorMessages.join("; ")}`
          );
        }
        errorHistory.add(errorSignature);
        console.log(`[generateEmailSpec] Structural error signature added to history. Total unique errors: ${errorHistory.size}`);
        console.log(`[generateEmailSpec] Continuing to attempt ${attempt + 1}`);
        
        continue;
      }

      // Success! Enhance theme with accessible colors, then return spec with warnings
      console.log(`[generateEmailSpec] ✅ SUCCESS on attempt ${attempt}! Enhancing theme...`);
      const enhancedSpec = {
        ...spec,
        theme: enhanceThemeWithAccessibleColors(spec.theme),
      };
      console.log(`[generateEmailSpec] Returning spec with ${warnings.length} warnings`);
      return { spec: enhancedSpec, warnings };

    } catch (error) {
      console.error(`[generateEmailSpec] Exception caught on attempt ${attempt}:`, error);
      
      if (error instanceof Error && error.name === "LLMError") {
        console.error(`[generateEmailSpec] LLMError thrown, propagating up`);
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
        console.error(`[generateEmailSpec] Timeout error detected`);
        throw createLLMError(
          "LLM_TIMEOUT",
          "LLM request timed out",
          error
        );
      }
      
      if (attempt === MAX_ATTEMPTS) {
        console.error(`[generateEmailSpec] Max attempts reached with error`);
        throw createLLMError(
          "LLM_FAILED",
          `Failed to generate EmailSpec after ${MAX_ATTEMPTS} attempts`,
          error
        );
      }
      
      // Continue to next attempt
      console.warn(`[generateEmailSpec] Request failed, will retry. Error: ${(error as Error).message}`);
      previousErrors = [`Request failed: ${(error as Error).message}`];
    }
  }

  console.error(`[generateEmailSpec] Loop completed without success or error - this should not happen`);
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
    "subject": "string (5-150 chars)",
    "preheader": "string (10-200 chars)"
  },
  "theme": {
    "containerWidth": number (typically 600),
    "backgroundColor": "hex color",
    "surfaceColor": "hex color",
    "textColor": "hex color",
    "mutedTextColor": "hex color",
    "primaryColor": "hex color",
    "font": { "heading": "string", "body": "string" },
    "button": { "radius": number, "style": "solid" | "outline" | "soft", "paddingY": number, "paddingX": number },
    "palette": {
      "primary": "hex", "ink": "hex", "bg": "hex", "surface": "hex",
      "muted": "hex", "accent": "hex", "primarySoft": "hex", "accentSoft": "hex"
    },
    "rhythm": { "sectionGap": number, "contentPaddingX": number, "contentPaddingY": number },
    "components": {
      "button": { "radius": number, "style": "solid" | "outline" | "soft", "paddingY": number, "paddingX": number },
      "card": { "radius": number, "border": "none" | "hairline", "shadow": "none" | "soft" }
    }
  },
  "sections": [
    {
      "id": "unique-string",
      "type": "header" | "navHeader" | "announcementBar" | "hero" | "feature" | "benefitsList" | "storySection" | "productGrid" | "socialProofGrid" | "testimonial" | "trustBar" | "faq" | "secondaryCTA" | "legalFinePrint" | "footer",
      "variant": "optional variant name",
      "style": {
        "background": "bg" | "surface" | "muted" | "primarySoft" | "accentSoft" | "primary" | "accent" | "transparent" | "brand" | "image",
        "text": "ink" | "bg",
        "container": "flat" | "card",
        "divider": "none" | "top" | "bottom" | "both",
        "paddingX": number,
        "paddingY": number
      },
      "blocks": [ /* blocks go here */ ],
      "layout": {
        "variant": "single" | "twoColumn" | "grid",
        // For twoColumn: "columns": [{"width": "50%", "blocks": [...]}, {"width": "50%", "blocks": [...]}]
        // For grid: "columns": 2 | 3, "gap": number
      }
    }
  ],
  "catalog": { "items": [...products from brand context...] }
}

SECTION TYPES GUIDE:
- "announcementBar": Top banner with short text + optional link (e.g., "Free shipping on orders over $50")
- "navHeader": Logo + navigation links + optional preheader text
- "header": Standard logo header
- "hero": Main banner with headline, image, CTA
- "benefitsList": Headline + bullet points highlighting features/benefits
- "feature": Feature highlight section
- "storySection": Image + headline + paragraph + link (use for brand story, about, etc.)
- "productGrid": Product showcase
- "socialProofGrid": Grid of logos (press, partners, certifications)
- "testimonial": Customer testimonials
- "trustBar": Trust badges
- "faq": 3-6 Q&A pairs
- "secondaryCTA": Colored band with headline + button (use mid-email or before footer)
- "legalFinePrint": Small text with links (terms, privacy)
- "footer": Footer with unsubscribe

BLOCK TYPES:
  { "type": "logo", "src": "url", "href": "url optional" }
  { "type": "heading", "text": "string", "level": 1-3, "align": "left"|"center"|"right" }
  { "type": "paragraph", "text": "string", "align": "left"|"center"|"right" }
  { "type": "image", "src": "url", "alt": "text", "href": "url optional" }
  { "type": "button", "text": "string", "href": "url", "variant": "primary"|"secondary" }
  { "type": "productCard", "productRef": "catalog-product-id" }
  { "type": "badge", "text": "string", "tone": "primary"|"accent"|"muted"|"success"|"warning"|"error" }
  { "type": "bullets", "items": ["item1", "item2", ...], "icon": "optional icon emoji or symbol" }
  { "type": "priceLine", "price": "$99", "compareAt": "$149 optional", "savingsText": "Save $50 optional" }
  { "type": "rating", "value": 4.5, "count": 123 }
  { "type": "navLinks", "links": [{"label": "Shop", "url": "..."}, ...] }
  { "type": "socialIcons", "links": [{"network": "facebook"|"twitter"|"instagram"|..., "url": "..."}, ...] }
  { "type": "divider" }
  { "type": "spacer", "size": number }
  { "type": "smallPrint", "text": "string (must include {{unsubscribe}} in footer)" }

CRITICAL RULES:
1. Generate **7-12 sections** for most campaigns (unless user prompt is very brief)
2. **ALTERNATE backgrounds**: Avoid 3+ consecutive sections with same background token
3. Use background tokens ONLY: "bg", "surface", "muted", "primarySoft", "accentSoft", "primary", "accent", "transparent", "brand", "image"
4. DO NOT invent hex colors - use brand tokens from palette
5. Prefer realistic layouts:
   - Announcement bar (optional)
   - Nav header or header
   - Hero
   - Benefits/features
   - Social proof or story
   - Product grid (if ecommerce)
   - FAQ or testimonial
   - Secondary CTA
   - Footer
6. First section must be type="header" or "navHeader" or "announcementBar", last section must be type="footer"
7. Footer MUST contain a smallPrint block with {{unsubscribe}} token
8. Include at least one button with text and href
9. All section IDs must be unique
10. LAYOUT RULES:
    - Single column (default): Omit layout field OR set {"variant": "single"}, put blocks in section.blocks array
    - Two columns: {"variant": "twoColumn", "columns": [{"width": "50%", "blocks": [...]}, {"width": "50%", "blocks": [...]}]}, set section.blocks to []
    - Grid: {"variant": "grid", "columns": 2 or 3, "gap": 16}, put blocks in section.blocks array
    - CRITICAL: variant must be EXACTLY "single", "twoColumn", or "grid" (case-sensitive, no spaces)

EXAMPLE SECTION SEQUENCES:
Launch campaign: announcementBar → navHeader → hero → benefitsList → storySection → socialProofGrid → productGrid → faq → secondaryCTA → footer
Sale campaign: announcementBar → header → hero → productGrid → benefitsList → testimonial → secondaryCTA → legalFinePrint → footer
Newsletter: header → hero → storySection → feature → feature → benefitsList → secondaryCTA → footer

LAYOUT EXAMPLES:
Single column section (most common):
{
  "id": "hero-01",
  "type": "hero",
  "blocks": [{"type": "heading", "text": "Welcome"}, {"type": "button", "text": "Shop Now", "href": "..."}]
}

Two-column section:
{
  "id": "feature-01",
  "type": "feature",
  "layout": {
    "variant": "twoColumn",
    "columns": [
      {"width": "50%", "blocks": [{"type": "image", "src": "...", "alt": "..."}]},
      {"width": "50%", "blocks": [{"type": "heading", "text": "..."}, {"type": "paragraph", "text": "..."}]}
    ]
  },
  "blocks": []
}

Grid section:
{
  "id": "products-01",
  "type": "productGrid",
  "layout": {"variant": "grid", "columns": 3, "gap": 16},
  "blocks": [{"type": "productCard", "productRef": "prod-1"}, {"type": "productCard", "productRef": "prod-2"}]
}

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
1. Convert plan sections into EmailSpec sections with actual blocks (logo, heading, paragraph, button, bullets, etc.)
2. Write compelling copy based on the plan's guidance (headline, body, CTAs)
3. Use the plan's subject as meta.subject and create a preheader
4. Apply brand colors/fonts to theme AND derive full palette with brand-derived tokens
5. Convert plan's selectedProducts into catalog items and reference them in productCard blocks
6. **Create 7-12 sections** with varied backgrounds for visual richness

BRAND CONTEXT (colors, fonts, products, voice):
${JSON.stringify(brandContext, null, 2)}

CAMPAIGN INTENT (goal, tone, CTA):
${JSON.stringify(intent, null, 2)}

EMAIL PLAN (structure to transform):
${JSON.stringify(plan, null, 2)}

TRANSFORM INTO EMAILSPEC WITH:
- meta: { subject: "${plan.subject?.primary || "Compelling subject line"}", preheader: "..." }
- theme: {
    containerWidth: 600,
    backgroundColor: brand background,
    surfaceColor: slightly darker/lighter bg,
    textColor: brand text,
    mutedTextColor: blend of bg + text,
    primaryColor: brand primary,
    palette: {
      primary: brand primary,
      ink: brand text,
      bg: brand background,
      surface: blend(bg, ink, 5%),
      muted: blend(bg, ink, 15%),
      accent: derived from primary (shifted hue),
      primarySoft: blend(primary, bg, 85%),
      accentSoft: blend(accent, bg, 85%)
    },
    rhythm: { sectionGap: 24, contentPaddingX: 16, contentPaddingY: 24 },
    components: {
      button: { radius: 8, style: "solid", paddingY: 12, paddingX: 24 },
      card: { radius: 8, border: "none", shadow: "none" }
    }
  }
- sections: array of 7-12 sections (expand beyond plan if needed for realistic flow)
  - Use section.style.background tokens: "bg", "surface", "muted", "primarySoft", "accentSoft", "primary", "accent"
  - **ALTERNATE backgrounds**: e.g., bg → primarySoft → bg → surface → accentSoft → bg
  - Use new section types: announcementBar, navHeader, benefitsList, storySection, socialProofGrid, faq, secondaryCTA
  - Use new blocks: badge, bullets, priceLine, rating, navLinks, socialIcons
- catalog: { items: products from brandContext.catalog }

REQUIREMENTS:
- **7-12 sections minimum** for realistic emails (not just ${plan.sections?.length || 3})
- First section can be "announcementBar", "navHeader", or "header"
- Last section must be type="footer" with smallPrint block containing "{{unsubscribe}}"
- **ALTERNATE section.style.background** - avoid 3+ in a row with same token
- Use brand-derived palette tokens ONLY (no random hex in section styles)
- Write actual email copy in heading/paragraph/bullets blocks based on plan guidance
- Include at least one button block with text and href
- Add a secondaryCTA section before footer
- Use new block types where appropriate (bullets for benefits, rating for products, etc.)
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
- Fix the errors listed above
- If errors mention "layout.variant": Use EXACTLY "single", "twoColumn", or "grid" (case-sensitive)
- If errors mention BACKGROUND_MONOTONY: alternate section.style.background tokens
- If errors mention TOO_FEW_SECTIONS: expand to 7-12 sections
- If errors mention MISSING_SECONDARY_CTA: add a secondaryCTA section before footer
- Ensure first section is "announcementBar", "navHeader", or "header"
- Ensure last section is "footer"
- Include at least one button with valid text and href
- Footer must have {{unsubscribe}} token in smallPrint block
- All section IDs must be unique
- All productCard blocks must reference catalog items
- Use palette tokens for backgrounds: "bg", "surface", "muted", "primarySoft", "accentSoft", "primary", "accent"
${intent.cta?.primary ? `- Button text should match: "${intent.cta.primary}"` : ""}

${attempt === 3 ? `FINAL ATTEMPT - Be extra careful:
- Double-check every product reference exists in catalog
- Verify first section type is valid header type
- Verify footer is sections[last]
- Confirm button has both text and href properties
- Verify all colors are valid hex codes
- Alternate section backgrounds to avoid monotony
- Include 7-12 sections total
- Check that all required schema fields are present` : ""}

Generate the corrected EmailSpec JSON.`;
  }

  return prompt;
}
