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
 * Helper to extract font information from BrandContext
 * Handles both string and BrandFont object formats
 */
function getFontInfo(font: string | { name: string; sourceUrl?: string } | undefined, defaultFont: string = 'Arial'): {
  name: string;
  sourceUrl?: string;
  displayString: string;
} {
  if (!font) {
    return { name: defaultFont, displayString: defaultFont };
  }
  
  if (typeof font === 'string') {
    return { name: font, displayString: font };
  }
  
  // BrandFont object
  return {
    name: font.name,
    sourceUrl: font.sourceUrl,
    displayString: font.sourceUrl 
      ? `${font.name} (with web font from ${font.sourceUrl})`
      : font.name
  };
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
    "backgroundColor": "hex color (MUST be light - e.g., #FFFFFF, #F9F9F9, #F5F5F5 - NEVER dark/black)",
    "surfaceColor": "hex color (MUST be light)",
    "textColor": "hex color",
    "mutedTextColor": "hex color",
    "primaryColor": "hex color",
    "font": {
      "heading": "string OR { name: string, sourceUrl: string } (use EXACT format from brand.fonts.heading)",
      "body": "string OR { name: string, sourceUrl: string } (use EXACT format from brand.fonts.body)"
    },
    "button": { "radius": number, "style": "solid" | "outline" | "soft", "paddingY": number, "paddingX": number },
    "palette": {
      "primary": "hex", "ink": "hex", "bg": "hex (MUST be light - NEVER dark/black)", "surface": "hex (MUST be light)",
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
**Header Types (use ONE at start):**
- "announcementBar": Top banner with short text + optional link (e.g., "Free shipping on orders over $50")
- "navHeader": Logo + navigation links + optional preheader text
- "header": Standard logo header

**Main Content Sections:**
- "hero": Main banner with headline, image, CTA
- "benefitsList": Headline + bullet points highlighting features/benefits (each bullet should be 1-2 sentences, not just keywords)
- "feature": Feature highlight section
- "featureGrid": 2-3 benefit blocks with icons - each should have a heading + 2-3 sentence paragraph explaining the benefit (NEW v2)
- "storySection": Image + headline + 2-3 rich paragraphs telling brand story, mission, or about the company. Use for "Our Story", "About Us", "Why We Started", etc. Each paragraph should be 3-4 sentences with emotional resonance and authentic detail.
- "founderNote": Personal message from founder/CEO with heading + 3-4 paragraph blocks. Should feel authentic, vulnerable, and connect the founder's vision to customer benefit. Use sparingly for relationship-building campaigns.
- "productGrid": Product showcase
- "productSpotlight": Single product card + 4-6 detailed bullet points + compelling CTA. Bullets should explain features AND benefits (NEW v2)
- "comparison": Before/after or without/with in 2 columns (NEW v2)
- "socialProofGrid": Grid of logos (press, partners, certifications)
- "testimonial": Customer testimonials - use full quotes with context (3-5 sentences), not just soundbites
- "testimonialCard": Quote (2-3 sentences minimum) + person + company/context (NEW v2)
- "trustBar": Trust badges
- "metricStrip": 1-3 big metrics/stats (NEW v2)
- "faq": 3-6 Q&A pairs
- "faqMini": EXACTLY 3 Q&A pairs. Each answer MUST be 2-3 complete sentences with helpful detail (NEW v2)
- "sectionTitle": Tiny kicker + title (NEW v2)
- "dividerBand": Visual rhythm section (NEW v2)

**CTA Sections:**
- "secondaryCTA": Colored band with headline + button (use mid-email or before footer)
- "ctaBanner": High-contrast CTA moment (NEW v2)

**Footer Types:**
- "legalFinePrint": Small text with links (terms, privacy)
- "footer": Footer with unsubscribe (REQUIRED at end)

BLOCK TYPES:
  { "type": "logo", "src": "url", "href": "url optional" }
  { "type": "heading", "text": "string", "level": 1-3, "align": "left"|"center"|"right" }
    NOTE: Header sections (header/navHeader/announcementBar) render at 48px for level 1, making them the most eye-catching element in the email
    Hero and other sections use 32px for level 1. Always use level: 1 for main headers to ensure maximum visual impact.
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
  { "type": "smallPrint", "text": "string (must include <a href='https://www.example.com/unsubscribe'>unsubscribe</a> link in footer)" }

CRITICAL RULES (v2):
1. **EMAIL BACKGROUND MUST BE LIGHT**: theme.backgroundColor and palette.bg MUST ALWAYS be light colors (e.g., #FFFFFF, #F9F9F9, #F5F5F5). NEVER use dark colors like black (#000000) or dark grays for the main email background. Individual sections can have dark backgrounds, but the overall email background must be light.
2. Generate **5-8 sections** for most campaigns (realistic, not overwhelming)
3. **ALTERNATE backgrounds**: Avoid 3+ consecutive sections with same background token
4. **v2 Background tokens** (preferred): "base", "alt", "brandTint", "brandSolid", "surface", "muted", "primarySoft", "accentSoft"
   Legacy tokens still work: "bg" (=base), "primary", "accent", "transparent", "brand", "image"
5. DO NOT invent hex colors - use brand tokens from palette
6. **USE BRAND FONTS**: theme.font.heading and theme.font.body MUST use the EXACT format from brandContext.brand.fonts (either string OR object with name + sourceUrl). If the brand font has a sourceUrl, you MUST include it as an object: { "name": "FontName", "sourceUrl": "https://..." }. If no sourceUrl, use the string format: "FontName".
7. **CONTRAST IS AUTOMATIC**: The rendering system automatically ensures proper contrast. Dark backgrounds (brandSolid, primary, accent) get light text, light backgrounds (base, alt, surface) get dark text. You only specify section backgrounds - text colors are calculated automatically for accessibility (WCAG AA 4.5:1 for text, 3:1 for buttons).
8. **Prefer modern section types**:
   - Use featureGrid over multiple feature sections
   - Use productSpotlight for single products, productGrid for multiple
   - Use ctaBanner instead of secondaryCTA for high-impact CTAs
   - Use testimonialCard for structured testimonials
   - Use metricStrip for stats/urgency
9. First section must be type="header" or "navHeader" or "announcementBar", last section must be type="footer"
10. Footer MUST contain a smallPrint block with an unsubscribe link: <a href='https://www.example.com/unsubscribe'>unsubscribe</a>
11. **One primary CTA**: Use consistent button text for primary CTA (repeat in hero and ctaBanner)
12. All section IDs must be unique
13. **HIGH-QUALITY CONTENT REQUIREMENTS**:
    - ALL paragraphs must be 3-4 complete sentences minimum (not fragments or single sentences)
    - Bullet points must be full sentences with specific details, not just keywords
    - StorySection paragraphs should be rich, authentic, and emotionally engaging (3-4 sentences each)
    - FounderNote sections should include 3-4 paragraph blocks with personal, vulnerable storytelling
    - Testimonials must be detailed quotes (3-5 sentences) with context, not soundbites
    - FAQ answers must be comprehensive (2-3 sentences) with actionable information
    - FeatureGrid blocks should have heading + 2-3 sentence explanatory paragraph
    - ProductSpotlight bullets should explain both feature AND customer benefit (1-2 sentences each)
13. LAYOUT RULES:
    - Single column (default): Omit layout field OR set {"variant": "single"}, put blocks in section.blocks array
    - Two columns: MUST use EXACTLY this structure:
      {
        "variant": "twoColumn",
        "columns": [
          {"width": "50%", "blocks": [/* left column blocks */]},
          {"width": "50%", "blocks": [/* right column blocks */]}
        ]
      }
      AND set section.blocks to [] (empty array)
      NOTE: "columns" MUST be an array with EXACTLY 2 objects, each with "width" (string ending in %) and "blocks" (array)
    - Grid: {"variant": "grid", "columns": 2 or 3, "gap": 16}, put blocks in section.blocks array
    - CRITICAL: variant must be EXACTLY "single", "twoColumn", or "grid" (case-sensitive, no spaces)
    - CRITICAL: For twoColumn, "columns" field is REQUIRED and must be a 2-element array

EXAMPLE SECTION SEQUENCES (5-8 sections recommended):
**Launch campaign**: announcementBar → hero → featureGrid → productSpotlight → testimonialCard → ctaBanner → footer
**Sale campaign**: header → hero → productGrid → metricStrip → faqMini → ctaBanner → footer  
**Newsletter**: navHeader → hero → storySection → featureGrid → testimonialCard → ctaBanner → footer
**Brand storytelling**: header → hero → storySection → founderNote → socialProofGrid → ctaBanner → footer
**Relationship-building**: navHeader → hero → storySection → testimonialCard → faqMini → ctaBanner → footer
**Reactivation**: header → hero → benefitsList → socialProofGrid → ctaBanner → footer

CONTENT QUALITY EXAMPLES:

**HIGH-QUALITY storySection** (About Us / Brand Story):
{
  "id": "story-01",
  "type": "storySection",
  "blocks": [
    {"type": "heading", "text": "Our Story: Born from Frustration, Built with Purpose", "level": 2},
    {"type": "paragraph", "text": "In 2019, our founder Sarah was juggling a demanding career while trying to maintain a healthy lifestyle. She spent countless hours researching supplements, only to find confusing labels, dubious claims, and products filled with unnecessary additives. The frustration reached a breaking point when she realized the industry prioritized profits over people's wellbeing. That's when she decided to create something different."},
    {"type": "paragraph", "text": "We started in a small lab with one mission: create supplements that we'd be proud to give our own families. Every ingredient is sourced from certified organic farms, tested by third-party labs, and formulated by nutrition scientists who actually care about your health. We stripped away the marketing fluff and focused on what matters—real ingredients, real results, real transparency. Today, over 50,000 families trust us to support their wellness journey."},
    {"type": "paragraph", "text": "What makes us different isn't just our products—it's our promise. We publish every test result, source every ingredient ethically, and back everything with a 60-day money-back guarantee because we believe you deserve to feel confident about what you put in your body. Join us in redefining what wellness companies should be."},
    {"type": "button", "text": "Discover Our Standards", "href": "https://example.com/about"}
  ]
}

**HIGH-QUALITY founderNote**:
{
  "id": "founder-01",
  "type": "founderNote",
  "blocks": [
    {"type": "heading", "text": "A Personal Note from Sarah, Founder & CEO", "level": 2},
    {"type": "paragraph", "text": "I still remember the morning that changed everything. I was standing in my kitchen, surrounded by vitamin bottles, feeling overwhelmed and honestly a bit betrayed. I'd spent years trusting brands that turned out to prioritize their bottom line over my health. As a working mother of two, I didn't have time to become a biochemistry expert—I just wanted products that worked and companies that cared."},
    {"type": "paragraph", "text": "That frustration became my fuel. I spent the next two years working with nutritionists, visiting organic farms, and learning everything about supplement manufacturing. I discovered that creating truly clean, effective products wasn't impossible—it just required putting people before profits. The industry said consumers wouldn't pay for premium ingredients. They said transparency would hurt sales. They were wrong on both counts."},
    {"type": "paragraph", "text": "Today, when I see emails from customers telling me their lives have changed, I'm reminded why we do this work. Every bottle we ship represents a promise: that your health matters more than our margins. That you deserve to know exactly what you're taking and why. That wellness should be accessible, honest, and effective."},
    {"type": "paragraph", "text": "Thank you for trusting us with your wellbeing. We don't take that responsibility lightly."},
    {"type": "paragraph", "text": "With gratitude,\nSarah Chen\nFounder & CEO"}
  ]
}

LAYOUT EXAMPLES:
Single column section (most common):
{
  "id": "hero-01",
  "type": "hero",
  "blocks": [{"type": "heading", "text": "Welcome"}, {"type": "button", "text": "Shop Now", "href": "..."}]
}

Two-column section (CRITICAL - columns field is REQUIRED with EXACTLY 2 elements):
{
  "id": "feature-01",
  "type": "feature",
  "layout": {
    "variant": "twoColumn",
    "columns": [
      {"width": "50%", "blocks": [{"type": "image", "src": "https://example.com/image.jpg", "alt": "Feature image"}]},
      {"width": "50%", "blocks": [{"type": "heading", "text": "Amazing Feature", "level": 2}, {"type": "paragraph", "text": "Detailed description here."}]}
    ]
  },
  "blocks": []
}
NOTE: When using twoColumn layout:
- The "columns" field is REQUIRED (not optional)
- Must contain EXACTLY 2 column objects (no more, no less)
- Each column object MUST have "width" (string like "50%") and "blocks" (array)
- The section.blocks array MUST be empty []

Grid section:
{
  "id": "products-01",
  "type": "productGrid",
  "layout": {"variant": "grid", "columns": 3, "gap": 16},
  "blocks": [{"type": "productCard", "productRef": "prod-1"}, {"type": "productCard", "productRef": "prod-2"}]
}

FAQ Mini section (EXACTLY 3 Q&A pairs, each answer 2-3 sentences):
{
  "id": "faq-01",
  "type": "faqMini",
  "blocks": [
    {"type": "heading", "text": "What is your return policy?", "level": 3},
    {"type": "paragraph", "text": "We offer a 30-day money-back guarantee on all purchases. If you're not completely satisfied, simply contact our support team to initiate a return. We'll process your refund within 5-7 business days."},
    {"type": "heading", "text": "How long does shipping take?", "level": 3},
    {"type": "paragraph", "text": "Standard shipping typically takes 3-5 business days within the continental US. Expedited shipping options are available at checkout for faster delivery. International orders may take 7-14 business days depending on customs processing."},
    {"type": "heading", "text": "Do you offer customer support?", "level": 3},
    {"type": "paragraph", "text": "Yes, our customer support team is available 24/7 via email, phone, and live chat. We pride ourselves on responding to all inquiries within 2 hours during business hours. Our team is here to help with any questions or concerns you may have."}
  ]
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
  
  // Extract font information
  const headingFont = getFontInfo(brandContext.brand?.fonts?.heading);
  const bodyFont = getFontInfo(brandContext.brand?.fonts?.body);

  let prompt = "";

  if (attempt === 1) {
    // First attempt - standard generation
    prompt = `Transform the following EMAIL PLAN into a complete EmailSpec JSON with actual email content.

The EmailPlan provides high-level structure and guidance. You must:
1. Convert plan sections into EmailSpec sections with actual blocks (logo, heading, paragraph, button, bullets, etc.)
2. Write HIGH-QUALITY, detailed copy based on the plan's guidance (see content quality requirements below)
3. Use the plan's subject as meta.subject and create a preheader
4. Apply brand colors/fonts to theme AND derive full palette with brand-derived tokens
5. Convert plan's selectedProducts into catalog items and reference them in productCard blocks
6. **Create 5-8 sections** with varied backgrounds for visual richness

CONTENT QUALITY REQUIREMENTS - WRITE LIKE A PROFESSIONAL COPYWRITER:
- **All paragraphs**: 3-4 complete, well-crafted sentences minimum (not fragments)
- **StorySection**: Use 2-3 rich paragraph blocks telling authentic brand story (3-4 sentences each)
- **FounderNote**: Include 3-4 personal paragraph blocks with vulnerable, relatable storytelling
- **Bullet points**: Full sentences explaining specific benefits, not just keywords (e.g., "Reduces inflammation by 40% in clinical trials, helping you recover faster" not just "Reduces inflammation")
- **Testimonials**: Detailed 3-5 sentence quotes with specific context and results
- **FAQ answers**: Comprehensive 2-3 sentence responses with actionable details
- **FeatureGrid**: Each feature needs heading + 2-3 sentence explanatory paragraph
- **ProductSpotlight bullets**: 4-6 bullets, each 1-2 sentences explaining feature AND customer benefit

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
    backgroundColor: ALWAYS use a light color (e.g., #FFFFFF, #F9F9F9, #F5F5F5) - NEVER use dark colors like black,
    surfaceColor: slightly darker than bg (but still light),
    textColor: brand text,
    mutedTextColor: blend of bg + text,
    primaryColor: brand primary,
    font: {
      heading: ${headingFont.sourceUrl ? `{ "name": "${headingFont.name}", "sourceUrl": "${headingFont.sourceUrl}" }` : `"${headingFont.name}"`},
      body: ${bodyFont.sourceUrl ? `{ "name": "${bodyFont.name}", "sourceUrl": "${bodyFont.sourceUrl}" }` : `"${bodyFont.name}"`}
    },
    palette: {
      primary: brand primary,
      ink: brand text,
      bg: ALWAYS a light color (e.g., #FFFFFF, #F9F9F9, #F5F5F5) - NEVER dark,
      surface: blend(bg, ink, 5%) but ensure still light,
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
- sections: array of **5-8 sections** (quality over quantity - v2 guideline)
  - **v2 Background tokens** (preferred): "base", "alt", "brandTint", "brandSolid", "surface", "muted"
  - **ALTERNATE backgrounds**: e.g., base → brandTint → alt → surface → base → brandSolid
  - **Use v2 section types**: featureGrid, productSpotlight, comparison, metricStrip, testimonialCard, ctaBanner, faqMini, dividerBand
  - Use blocks: badge, bullets, priceLine, rating, navLinks, socialIcons
- catalog: { items: products from brandContext.catalog }

REQUIREMENTS (v2):
- **EMAIL BACKGROUND MUST BE LIGHT**: theme.backgroundColor and palette.bg MUST be light colors (#FFFFFF, #F9F9F9, #F5F5F5) - NEVER dark/black
- **5-8 sections** for focused, engaging emails (not overwhelming)
- **USE EXACT BRAND FONTS**: 
  * Heading font: ${headingFont.displayString}
  * Body font: ${bodyFont.displayString}
  * Use the EXACT format shown in the theme.font example above (with sourceUrl if provided)
- First section: "announcementBar", "navHeader", or "header"
- Last section: type="footer" with smallPrint block containing "{{unsubscribe}}"
- **ALTERNATE section.style.background** - avoid 3+ in a row with same token
- Use brand-derived palette tokens ONLY (no random hex in section styles)
- **TEXT CONTRAST IS AUTOMATIC**: Only specify section.style.background. The renderer will automatically calculate contrasting text colors (dark backgrounds → light text, light backgrounds → dark text) to meet WCAG AA standards. DO NOT manually set text colors.
- **HIGH-QUALITY CONTENT - CRITICAL**:
  - Write professional, detailed copy with complete sentences and specific details
  - ALL paragraphs: 3-4 sentences minimum with substance and authenticity
  - StorySection: 2-3 rich paragraphs telling compelling brand narrative (3-4 sentences each)
  - FounderNote: 3-4 personal paragraphs with vulnerable, relatable storytelling
  - Bullets: Full sentences with specific benefits, not keywords (1-2 sentences each)
  - Testimonials: Detailed 3-5 sentence quotes with context and specific results
  - Consider adding storySection or founderNote for relationship-building campaigns
- **faqMini sections**: MUST have EXACTLY 3 Q&A pairs. Each answer MUST be 2-3 complete, helpful sentences that provide real value. Questions should address common customer concerns related to the campaign goal. Format: heading (question) → paragraph (answer) → heading → paragraph → heading → paragraph.
- **One primary CTA**: Use consistent button text (e.g., "${intent.cta?.primary || "Shop Now"}") in hero and ctaBanner sections
- Prefer: featureGrid > multiple features, ctaBanner > secondaryCTA, testimonialCard > generic testimonial
- Use detailed bullets with complete sentences explaining benefits

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

CRITICAL REPAIR INSTRUCTIONS (v2, Attempt ${attempt}/${MAX_ATTEMPTS}):
- Fix the errors listed above
- **EMAIL BACKGROUND MUST BE LIGHT**: theme.backgroundColor and palette.bg MUST be light colors (e.g., #FFFFFF, #F9F9F9, #F5F5F5) - NEVER dark/black
- **USE EXACT BRAND FONTS**: 
  * Heading: ${headingFont.sourceUrl ? `{ "name": "${headingFont.name}", "sourceUrl": "${headingFont.sourceUrl}" }` : `"${headingFont.name}"`}
  * Body: ${bodyFont.sourceUrl ? `{ "name": "${bodyFont.name}", "sourceUrl": "${bodyFont.sourceUrl}" }` : `"${bodyFont.name}"`}
  * CRITICAL: If brand has sourceUrl, you MUST include it in the font object format, not just the string name
- If errors mention "layout.variant" or "layout.columns": 
  * Ensure variant is EXACTLY "single", "twoColumn", or "grid" (case-sensitive)
  * For twoColumn: MUST include "columns" field with EXACTLY 2 column objects
  * Each column object MUST have {"width": "50%", "blocks": [...]}
  * When using twoColumn, section.blocks MUST be [] (empty)
- If errors mention BACKGROUND_MONOTONY: alternate section.style.background tokens (base/alt/brandTint)
- If errors mention TOO_FEW_SECTIONS: expand to 5-8 sections using v2 section types
- If errors mention MISSING_SECONDARY_CTA: add a ctaBanner section before footer
- Ensure first section is "announcementBar", "navHeader", or "header"
- Ensure last section is "footer"
- Include at least one button with valid text and href
- **One primary CTA**: Use consistent button text "${intent.cta?.primary || "Shop Now"}" in hero and ctaBanner
- Footer must have an unsubscribe link in smallPrint block: <a href='https://www.example.com/unsubscribe'>unsubscribe</a>
- All section IDs must be unique
- All productCard blocks must reference catalog items
- **v2 Background tokens**: "base", "alt", "brandTint", "brandSolid", "surface", "muted", "primarySoft", "accentSoft"
- **TEXT CONTRAST**: DO NOT manually set text colors. The system automatically ensures dark backgrounds get light text and light backgrounds get dark text (WCAG AA compliant)
${intent.cta?.primary ? `- Primary button text must be: "${intent.cta.primary}"` : ""}

${attempt === 3 ? `FINAL ATTEMPT (v2) - Be extra careful:
- **CRITICAL**: theme.backgroundColor and palette.bg MUST be light colors (#FFFFFF, #F9F9F9, #F5F5F5) - NEVER dark/black
- Use EXACT brand fonts with proper format:
  * Heading: ${headingFont.sourceUrl ? `{ "name": "${headingFont.name}", "sourceUrl": "${headingFont.sourceUrl}" }` : `"${headingFont.name}"`}
  * Body: ${bodyFont.sourceUrl ? `{ "name": "${bodyFont.name}", "sourceUrl": "${bodyFont.sourceUrl}" }` : `"${bodyFont.name}"`}
  * MUST use object format { name, sourceUrl } if sourceUrl is available
- Double-check every product reference exists in catalog
- Verify first section type is valid header type (header/navHeader/announcementBar)
- Verify footer is sections[last]
- Confirm button has both text and href properties
- **One consistent primary CTA**: "${intent.cta?.primary || "Shop Now"}" in hero + ctaBanner
- Verify all colors are valid hex codes
- Alternate section backgrounds (base/alt/brandTint/surface)
- Include 5-8 sections total (v2 guideline)
- Use v2 section types: featureGrid, productSpotlight, ctaBanner, testimonialCard, metricStrip
- Check that all required schema fields are present
- Remember: text and button colors are automatically calculated for contrast - only specify background tokens` : ""}

Generate the corrected EmailSpec JSON.`;
  }

  return prompt;
}
