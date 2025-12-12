import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { EmailSpecSchema } from "@/lib/schemas/emailSpec";
import {
  renderEmailSpecToMjml,
  compileMjmlToHtml,
  type RendererWarning,
} from "@/lib/render/mjml/renderEmailSpec";

// Force dynamic rendering (no static optimization)
export const dynamic = "force-dynamic";

/**
 * POST /api/email/render
 * 
 * Converts an EmailSpec JSON to MJML and HTML
 * 
 * Request body:
 * {
 *   "spec": EmailSpec
 * }
 * 
 * Response (200):
 * {
 *   "html": string,
 *   "mjml": string,
 *   "warnings": RendererWarning[],
 *   "mjmlErrors": Array<{ message: string }>
 * }
 * 
 * Error responses:
 * - 400: Invalid input (INVALID_INPUT)
 * - 500: Render failed (RENDER_FAILED)
 * - 502: MJML compilation failed (MJML_COMPILE_FAILED)
 */
export async function POST(request: Request) {
  console.log("🔵 POST /api/email/render called");
  try {
    // Parse request body
    const body = await request.json();
    console.log("📦 Request body parsed, has spec:", !!body.spec);

    // Validate input with Zod
    const parseResult = EmailSpecSchema.safeParse(body.spec);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Invalid EmailSpec provided",
            details: parseResult.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const spec = parseResult.data;

    // Render EmailSpec to MJML
    let mjml: string;
    let warnings: RendererWarning[];

    console.log("Starting MJML render for spec with", spec.sections.length, "sections");

    try {
      const renderResult = renderEmailSpecToMjml(spec);
      mjml = renderResult.mjml;
      warnings = renderResult.warnings;
      console.log("MJML render successful, length:", mjml.length, "warnings:", warnings.length);
    } catch (error) {
      console.error("Render failed:", error);
      console.error("Stack:", error instanceof Error ? error.stack : "No stack");
      return NextResponse.json(
        {
          error: {
            code: "RENDER_FAILED",
            message: "Failed to render EmailSpec to MJML",
            details: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
        { status: 500 }
      );
    }

    // Compile MJML to HTML
    console.log("🔧 Starting MJML compilation...");
    const compileResult = await compileMjmlToHtml(mjml);

    // Log MJML and errors for debugging
    console.log("✅ MJML compilation completed");
    console.log("MJML compilation result:", {
      hasHtml: !!compileResult.html,
      htmlLength: compileResult.html.length,
      errorsCount: compileResult.errors.length,
      errors: compileResult.errors,
    });

    // If compilation produced errors but still returned HTML, continue
    // If compilation completely failed (no HTML), return error
    if (!compileResult.html && compileResult.errors.length > 0) {
      console.error("MJML compilation failed completely:", compileResult.errors);
      console.error("Generated MJML:", mjml);
      return NextResponse.json(
        {
          error: {
            code: "MJML_COMPILE_FAILED",
            message: "Failed to compile MJML to HTML",
            details: compileResult.errors,
            mjml: mjml, // Include MJML in error response for debugging
          },
        },
        { status: 502 }
      );
    }

    // Success - return HTML, MJML, warnings, and any MJML errors
    return NextResponse.json(
      {
        html: compileResult.html,
        mjml,
        warnings,
        mjmlErrors: compileResult.errors,
      },
      { status: 200 }
    );
  } catch (error) {
    // Catch-all for unexpected errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Invalid request format",
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

    console.error("Unexpected error in /api/email/render:", error);
    return NextResponse.json(
      {
        error: {
          code: "RENDER_FAILED",
          message: "An unexpected error occurred",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}

// Set route timeout to 15 seconds
export const maxDuration = 15;
