/**
 * PR3: Brand Ingestion Logic
 * Core business logic for brand ingestion endpoint
 */

import { z } from "zod";
import type { BrandContext } from "../types";
import { scrapeBrand } from "../scraper";
import { ScraperError, isScraperError } from "../scraper/errors";

/**
 * API Error codes as per spec
 */
export type ApiErrorCode =
  | "INVALID_URL"
  | "BLOCKED_URL"
  | "SCRAPE_TIMEOUT"
  | "SCRAPE_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL";

/**
 * Standardized API error
 */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    Error.captureStackTrace?.(this, ApiError);
  }
}

/**
 * Type guard for ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Request body schema
 */
const IngestRequestSchema = z.object({
  url: z.string().trim().min(1, "URL is required").url("Invalid URL format"),
});

/**
 * Validate and parse request body
 */
export function validateIngestRequest(body: unknown): { url: string } {
  try {
    return IngestRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstIssue = err.issues[0];
      throw new ApiError("INVALID_URL", firstIssue?.message || "Invalid URL");
    }
    throw new ApiError("INVALID_URL", "Invalid request body");
  }
}

/**
 * Map scraper errors to API errors
 */
function mapScraperError(err: ScraperError): ApiError {
  switch (err.code) {
    case "INVALID_URL":
      return new ApiError("INVALID_URL", "Invalid URL format", err);
    case "BLOCKED_URL":
      return new ApiError(
        "BLOCKED_URL",
        "URL is blocked (private/localhost IP addresses not allowed)",
        err
      );
    case "TIMEOUT":
      return new ApiError(
        "SCRAPE_TIMEOUT",
        "Scraping timed out. The website took too long to respond.",
        err
      );
    case "NAVIGATION_FAILED":
    case "PARSE_FAILED":
    case "EXTRACTION_FAILED":
      return new ApiError(
        "SCRAPE_FAILED",
        "Failed to scrape the website. Please try again or use a different URL.",
        err
      );
    default:
      return new ApiError("SCRAPE_FAILED", "Scraping failed", err);
  }
}

/**
 * Core brand ingestion logic
 * Can be called from API routes with dependency injection for testing
 */
export async function ingestBrand(
  url: string,
  scraperFn: (url: string) => Promise<BrandContext> = scrapeBrand
): Promise<BrandContext> {
  try {
    const brandContext = await scraperFn(url);
    return brandContext;
  } catch (err) {
    // Map scraper errors to API errors
    if (isScraperError(err)) {
      throw mapScraperError(err);
    }

    // Handle unexpected errors
    console.error("[ingestBrand] Unexpected error:", err);
    throw new ApiError(
      "INTERNAL",
      "An unexpected error occurred while processing your request",
      err
    );
  }
}

/**
 * Format API error response
 */
export function formatErrorResponse(error: unknown): {
  error: {
    code: ApiErrorCode;
    message: string;
  };
} {
  if (isApiError(error)) {
    return {
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  // Fallback for unexpected errors (don't leak stack traces)
  console.error("[formatErrorResponse] Unexpected error:", error);
  return {
    error: {
      code: "INTERNAL",
      message: "An unexpected error occurred",
    },
  };
}
