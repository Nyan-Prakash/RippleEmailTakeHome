import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BrandContextSchema } from "../../../../lib/schemas/brand";
import { CampaignIntentSchema } from "../../../../lib/schemas/campaign";
import { EmailPlanSchema } from "../../../../lib/schemas/plan";
import { generateEmailSpec } from "../../../../lib/llm/generateEmailSpec";
import { LLMError } from "../../../../lib/llm/errors";

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
 * Generate EmailSpec from brand context, campaign intent, and email plan
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid request body",
            details: parseResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { brandContext, intent, plan } = parseResult.data;

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // Generate EmailSpec with multi-attempt repair
      const result = await generateEmailSpec({
        brandContext,
        intent,
        plan,
      });

      clearTimeout(timeoutId);

      // Return spec with warnings (if any)
      return NextResponse.json(
        {
          spec: result.spec,
          ...(result.warnings.length > 0 && { warnings: result.warnings }),
        },
        { status: 200 }
      );
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (controller.signal.aborted) {
        return NextResponse.json(
          {
            error: {
              code: "LLM_TIMEOUT",
              message: "Email spec generation timed out after 15 seconds",
            },
          },
          { status: 504 }
        );
      }

      // Re-throw to outer handler
      throw error;
    }
  } catch (error) {
    console.error("[POST /api/email/spec] Error:", error);

    // Handle LLM errors
    if (error instanceof LLMError) {
      const statusCode =
        error.code === "LLM_TIMEOUT"
          ? 504
          : error.code === "LLM_OUTPUT_INVALID"
            ? 502
            : 500;

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

    // Generic error
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
        },
      },
      { status: 500 }
    );
  }
}
