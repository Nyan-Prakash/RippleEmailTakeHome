import type { EmailSpec } from "../schemas/emailSpec";
import type { BrandContext } from "../schemas/brand";
import type { CampaignIntent } from "../schemas/campaign";
import { EmailSpecSchema } from "../schemas/emailSpec";
import { createLLMError } from "./errors";

/**
 * Text field pointer for addressing specific fields in EmailSpec
 */
interface TextFieldPointer {
  path: string; // JSON pointer path
  type: "heading" | "paragraph" | "button" | "faq" | "announcement" | "finePrint";
  currentText: string;
  constraints?: {
    targetLength?: string;
    style?: string;
    avoid?: string[];
    voice?: string[];
  };
}

/**
 * LLM client interface for dependency injection
 */
export interface PolishCopyLLMClient {
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
 * Extract all editable text fields from EmailSpec
 */
function extractTextFields(spec: EmailSpec): TextFieldPointer[] {
  const fields: TextFieldPointer[] = [];

  spec.sections.forEach((section, sectionIdx) => {
    const metadata = section.metadata;
    const voice = metadata?.voice || [];
    const avoid = metadata?.avoid || [];

    section.blocks.forEach((block, blockIdx) => {
      const basePath = `/sections/${sectionIdx}/blocks/${blockIdx}`;

      switch (block.type) {
        case "heading":
          fields.push({
            path: `${basePath}/text`,
            type: "heading",
            currentText: block.text,
            constraints: { voice, avoid },
          });
          break;

        case "paragraph":
          fields.push({
            path: `${basePath}/text`,
            type: "paragraph",
            currentText: block.text,
            constraints: {
              targetLength: block.targetLength,
              style: block.style,
              voice,
              avoid,
            },
          });
          break;

        case "button":
          fields.push({
            path: `${basePath}/text`,
            type: "button",
            currentText: block.text,
            constraints: { voice, avoid },
          });
          break;

        case "bullets":
          block.items.forEach((item, itemIdx) => {
            fields.push({
              path: `${basePath}/items/${itemIdx}`,
              type: "paragraph",
              currentText: item,
              constraints: { targetLength: "1 sentence", voice, avoid },
            });
          });
          break;

        case "smallPrint":
          fields.push({
            path: `${basePath}/text`,
            type: "finePrint",
            currentText: block.text,
            constraints: { voice, avoid },
          });
          break;
      }
    });
  });

  return fields;
}

/**
 * Apply text replacements to EmailSpec
 */
function applyTextReplacements(
  spec: EmailSpec,
  replacements: Record<string, string>
): EmailSpec {
  const cloned = JSON.parse(JSON.stringify(spec)) as EmailSpec;

  Object.entries(replacements).forEach(([path, newText]) => {
    // Parse JSON pointer path
    const parts = path.split("/").filter((p) => p !== "");
    let current: any = cloned;

    // Navigate to the parent object
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const index = parseInt(part, 10);
      current = isNaN(index) ? current[part] : current[index];
    }

    // Set the value
    const lastPart = parts[parts.length - 1];
    const lastIndex = parseInt(lastPart, 10);
    if (isNaN(lastIndex)) {
      current[lastPart] = newText;
    } else {
      current[lastIndex] = newText;
    }
  });

  return cloned;
}

/**
 * Build system prompt for copy polish
 */
function buildPolishSystemPrompt(
  brandContext: BrandContext,
  campaignIntent: CampaignIntent
): string {
  const { brand } = brandContext;

  return `You are an expert email copywriter specializing in brand voice and conversion optimization.

# Brand Context
- Brand: ${brand.name}
- Voice Hints: ${brand.voiceHints.slice(0, 10).join(", ")}
- Tone: ${campaignIntent.tone || "professional"}

# Campaign
- Type: ${campaignIntent.type}
${campaignIntent.offer ? `- Offer: ${campaignIntent.offer}` : ""}
${campaignIntent.audience ? `- Audience: ${campaignIntent.audience}` : ""}
${campaignIntent.urgency ? `- Urgency: ${campaignIntent.urgency}` : ""}

# Your Task
You will receive a list of text fields from an email. For each field, rewrite it to be:
1. More compelling and on-brand
2. Clear and concise
3. Aligned with the campaign goal
4. Respectful of length constraints and style guidance

# Rules
- Maintain the core message and intent
- Respect length targets (short = 1-2 sentences, medium = 2-4, long = 4-6)
- Respect style guidance (editorial = flowing, scannable = punchy, emotional = evocative, technical = precise, minimal = terse)
- Respect voice descriptors (e.g., "warm", "confident") and avoid descriptors (e.g., "hype", "exclamation points")
- DO NOT use excessive punctuation (!!! or ???)
- DO NOT use ALL CAPS unless brand voice suggests it
- DO NOT add emojis unless brand voice is very casual
- Keep button text under 5 words and action-oriented
- Keep headings under 60 characters

Output ONLY valid JSON in this format:
{
  "replacements": {
    "/sections/0/blocks/0/text": "Polished text here",
    "/sections/0/blocks/1/text": "Another polished text"
  }
}`;
}

/**
 * Build user prompt for copy polish
 */
function buildPolishUserPrompt(fields: TextFieldPointer[]): string {
  const fieldDescriptions = fields.map((field, idx) => {
    const constraints = [];
    if (field.constraints?.targetLength) {
      constraints.push(`length: ${field.constraints.targetLength}`);
    }
    if (field.constraints?.style) {
      constraints.push(`style: ${field.constraints.style}`);
    }
    if (field.constraints?.voice && field.constraints.voice.length > 0) {
      constraints.push(`voice: ${field.constraints.voice.join(", ")}`);
    }
    if (field.constraints?.avoid && field.constraints.avoid.length > 0) {
      constraints.push(`avoid: ${field.constraints.avoid.join(", ")}`);
    }

    const constraintStr = constraints.length > 0 ? ` [${constraints.join("; ")}]` : "";

    return `${idx + 1}. ${field.type.toUpperCase()}: "${field.currentText}"${constraintStr}\n   Path: ${field.path}`;
  });

  return `Rewrite the following text fields to improve quality while respecting constraints:

${fieldDescriptions.join("\n\n")}

Return ONLY the JSON object with replacements.`;
}

/**
 * Polish copy in an EmailSpec using LLM
 * 
 * This function:
 * 1. Extracts all editable text fields
 * 2. Calls LLM to rewrite them with brand voice and constraints
 * 3. Applies replacements to a cloned spec
 * 4. Validates the result
 * 
 * Structure (sections, layout, links) remains unchanged.
 */
export async function polishEmailSpecCopy(
  spec: EmailSpec,
  brandContext: BrandContext,
  campaignIntent: CampaignIntent,
  options: {
    llmClient?: PolishCopyLLMClient;
    enabled?: boolean;
  } = {}
): Promise<{
  polishedSpec: EmailSpec;
  fieldsPolished: number;
  warnings: string[];
}> {
  // Feature flag check
  if (options.enabled === false) {
    return {
      polishedSpec: spec,
      fieldsPolished: 0,
      warnings: ["Copy polish disabled"],
    };
  }

  // Validate input spec first
  try {
    EmailSpecSchema.parse(spec);
  } catch (error) {
    throw createLLMError(
      "INVALID_INPUT",
      "Cannot polish copy: EmailSpec validation failed before polish"
    );
  }

  // Get LLM client
  const llmClient = options.llmClient || await getDefaultLLMClient();

  // Extract text fields
  const fields = extractTextFields(spec);

  if (fields.length === 0) {
    return {
      polishedSpec: spec,
      fieldsPolished: 0,
      warnings: ["No text fields found to polish"],
    };
  }

  // Build prompts
  const systemPrompt = buildPolishSystemPrompt(brandContext, campaignIntent);
  const userPrompt = buildPolishUserPrompt(fields);

  // Call LLM
  let response;
  try {
    response = await llmClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.code === "ETIMEDOUT") {
      throw createLLMError("LLM_TIMEOUT", "Copy polish timed out");
    }
    throw createLLMError("LLM_FAILED", `Copy polish failed: ${error.message}`);
  }

  // Parse response
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw createLLMError("LLM_OUTPUT_INVALID", "Empty response from copy polish");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw createLLMError("LLM_OUTPUT_INVALID", "Invalid JSON from copy polish");
  }

  const replacements = parsed.replacements || {};
  const warnings: string[] = [];

  // Apply replacements
  const polishedSpec = applyTextReplacements(spec, replacements);

  // Validate polished spec
  try {
    EmailSpecSchema.parse(polishedSpec);
  } catch (error: any) {
    warnings.push("Polished spec failed validation, reverting to original");
    return {
      polishedSpec: spec,
      fieldsPolished: 0,
      warnings,
    };
  }

  // Structural validation: ensure sections/blocks unchanged
  if (polishedSpec.sections.length !== spec.sections.length) {
    warnings.push("Section count changed during polish, reverting");
    return {
      polishedSpec: spec,
      fieldsPolished: 0,
      warnings,
    };
  }

  for (let i = 0; i < spec.sections.length; i++) {
    if (polishedSpec.sections[i].blocks.length !== spec.sections[i].blocks.length) {
      warnings.push(`Block count changed in section ${i}, reverting`);
      return {
        polishedSpec: spec,
        fieldsPolished: 0,
        warnings,
      };
    }
  }

  return {
    polishedSpec,
    fieldsPolished: Object.keys(replacements).length,
    warnings,
  };
}

/**
 * Get default LLM client (OpenAI)
 */
async function getDefaultLLMClient(): Promise<PolishCopyLLMClient> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw createLLMError(
      "LLM_CONFIG_MISSING",
      "OPENAI_API_KEY environment variable not set"
    );
  }

  const { OpenAI } = await import("openai");
  return new OpenAI({ apiKey }) as unknown as PolishCopyLLMClient;
}
