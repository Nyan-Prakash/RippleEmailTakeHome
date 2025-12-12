/**
 * PR3: Brand Ingestion Endpoint
 * POST /api/brand/ingest
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateIngestRequest,
  ingestBrand,
  formatErrorResponse,
  ApiError,
} from "@/lib/brand/ingest";
import { globalRateLimiter } from "@/lib/brand/rateLimiter";

/**
 * Server-side timeout (slightly above scraper's 10s budget)
 */
const REQUEST_TIMEOUT = 15000;

/**
 * Extract IP address from request for rate limiting
 */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return "unknown";
}

/**
 * POST /api/brand/ingest
 * Request body: { "url": string }
 * Response: { "brandContext": BrandContext } or { "error": { "code": string, "message": string } }
 */
export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  try {
    // 1. Rate limiting
    if (!globalRateLimiter.check(clientIp)) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        },
        { status: 429 }
      );
    }

    // 2. Parse and validate request body
    const body = await req.json();
    const { url } = validateIngestRequest(body);

    // 3. Call ingest logic with timeout
    const brandContextPromise = ingestBrand(url);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), REQUEST_TIMEOUT)
    );

    const brandContext = await Promise.race([
      brandContextPromise,
      timeoutPromise,
    ]);

    // 4. Return success response
    return NextResponse.json({ brandContext }, { status: 200 });
  } catch (err) {
    // Handle timeout
    if (err instanceof Error && err.message === "Request timeout") {
      return NextResponse.json(
        {
          error: {
            code: "SCRAPE_TIMEOUT",
            message: "Request timed out. Please try again.",
          },
        },
        { status: 504 }
      );
    }

    // Format error response
    const errorResponse = formatErrorResponse(err);
    const statusCode = getStatusCode(
      errorResponse.error.code as ApiError["code"]
    );

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

/**
 * Map error codes to HTTP status codes
 */
function getStatusCode(code: string): number {
  switch (code) {
    case "INVALID_URL":
      return 400;
    case "BLOCKED_URL":
      return 403;
    case "SCRAPE_TIMEOUT":
      return 504;
    case "SCRAPE_FAILED":
      return 502;
    case "RATE_LIMITED":
      return 429;
    default:
      return 500;
  }
}
