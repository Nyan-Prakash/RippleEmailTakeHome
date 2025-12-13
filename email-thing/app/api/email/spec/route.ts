import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BrandContextSchema } from "@/lib/schemas/brand";
import { CampaignIntentSchema } from "@/lib/llm/schemas/campaignIntent";
import { EmailPlanSchema } from "@/lib/llm/schemas/emailPlan";
import { generateEmailSpec } from "@/lib/llm/generateEmailSpec";
import { LLMError } from "@/lib/llm/errors";
import OpenAI from "openai";

/**
 * Request schema
 */
const RequestSchema = z.object({
  brandContext: BrandContextSchema,
  intent: CampaignIntentSchema,
  plan: EmailPlanSchema,
});

/**
 * POST /api/email/spec
 * 
 * Generate EmailSpec from brand context, intent, and plan
 * 
 * @returns EmailSpec with warnings array if successful
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid request body",
            details: parseResult.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const { brandContext, intent, plan } = parseResult.data;

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: {
            code: "LLM_CONFIG_MISSING",
            message: "OpenAI API key not configured",
          },
        },
        { status: 500 }
      );
    }

    // Initialize OpenAI client with 45 second timeout
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 45000,
    });

    // Set timeout for LLM request (50 seconds - slightly more than LLM client timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    try {
      // Generate EmailSpec with multi-attempt repair loop
      // (generateEmailSpec handles schema normalization internally)
      const { spec, warnings } = await generateEmailSpec({
        brandContext,
        intent,
        plan,
        llmClient: openai as any,
      });

      clearTimeout(timeoutId);

      // Return spec with warnings if any
      const response: any = { spec };
      if (warnings.length > 0) {
        response.warnings = warnings;
      }

      return NextResponse.json(response, { status: 200 });

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        const statusCode = getStatusCodeForLLMError(error.code);
        return NextResponse.json(
          {
            error: {
              code: error.code,
              message: error.message,
            },
          },
          { status: statusCode }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error("Unexpected error in /api/email/spec:", error);

    // Generic error response (no stack trace leak)
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Map LLM error codes to HTTP status codes
 */
function getStatusCodeForLLMError(code: string): number {
  switch (code) {
    case "INVALID_INPUT":
    case "INVALID_PROMPT":
      return 400;
    case "LLM_CONFIG_MISSING":
      return 500;
    case "LLM_TIMEOUT":
      return 504;
    case "LLM_OUTPUT_INVALID":
      return 502;
    case "LLM_FAILED":
    default:
      return 500;
  }
}
