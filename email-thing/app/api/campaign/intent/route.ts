import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BrandContextSchema } from "../../../../lib/types";
import { parseCampaignIntent } from "../../../../lib/llm/parseCampaignIntent";
import { LLMError } from "../../../../lib/llm/errors";

/**
 * Request schema for campaign intent endpoint
 */
const RequestSchema = z.object({
  brandContext: BrandContextSchema,
  prompt: z.string().min(1),
});

/**
 * Map LLM error codes to HTTP status codes
 */
function getStatusCode(errorCode: string): number {
  const statusMap: Record<string, number> = {
    INVALID_PROMPT: 400,
    LLM_CONFIG_MISSING: 500,
    LLM_FAILED: 502,
    LLM_TIMEOUT: 504,
    LLM_OUTPUT_INVALID: 502,
  };
  return statusMap[errorCode] ?? 500;
}

/**
 * POST /api/campaign/intent
 * Parses campaign intent from user prompt using LLM
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
            code: "INVALID_PROMPT",
            message: "Invalid request format",
          },
        },
        { status: 400 }
      );
    }

    const { brandContext, prompt } = validationResult.data;

    // Set timeout for LLM call (15 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // Parse campaign intent
      const intent = await parseCampaignIntent({
        brandContext,
        prompt,
      });

      clearTimeout(timeoutId);

      return NextResponse.json({ intent }, { status: 200 });
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
    console.error("Unexpected error in /api/campaign/intent:", error);
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
