import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BrandContextSchema } from "../../../../lib/schemas/brand";
import { CampaignIntentSchema } from "../../../../lib/llm/schemas/campaignIntent";
import { EmailPlanSchema } from "../../../../lib/llm/schemas/emailPlan";
import { generateEmailSpec } from "../../../../lib/llm/generateEmailSpec";
import { LLMError } from "../../../../lib/llm/errors";

/**
 * Request schema for email spec endpoint
 */
const RequestSchema = z.object({
  brandContext: BrandContextSchema,
  intent: CampaignIntentSchema,
  plan: EmailPlanSchema,
});

/**
 * Map LLM error codes to HTTP status codes
 */
function getStatusCode(errorCode: string): number {
  const statusMap: Record<string, number> = {
    INVALID_INPUT: 400,
    INVALID_PROMPT: 400,
    LLM_CONFIG_MISSING: 500,
    LLM_FAILED: 502,
    LLM_TIMEOUT: 504,
    LLM_OUTPUT_INVALID: 502,
  };
  return statusMap[errorCode] ?? 500;
}

/**
 * POST /api/email/spec
 * Generates canonical EmailSpec JSON from brand context, campaign intent, and email plan
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = RequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Invalid request format",
          },
        },
        { status: 400 }
      );
    }

    const { brandContext, intent, plan } = validationResult.data;

    // Set timeout for LLM call (15 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // Generate email spec
      const spec = await generateEmailSpec({
        brandContext,
        intent,
        plan,
      });

      clearTimeout(timeoutId);

      return NextResponse.json({ spec }, { status: 200 });
    } catch (error) {
      clearTimeout(timeoutId);

      if (controller.signal.aborted) {
        return NextResponse.json(
          {
            error: {
              code: "LLM_TIMEOUT",
              message: "Request timed out. Please try again.",
            },
          },
          { status: 504 }
        );
      }

      throw error;
    }
  } catch (error) {
    // Handle LLM errors
    if (error instanceof LLMError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: getStatusCode(error.code) }
      );
    }

    // Handle unexpected errors (no stack trace leak)
    console.error("Unexpected error in /api/email/spec:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
