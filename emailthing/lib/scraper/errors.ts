/**
 * Scraper error codes
 */
export type ScraperErrorCode =
  | "INVALID_URL"
  | "BLOCKED_URL"
  | "TIMEOUT"
  | "NAVIGATION_FAILED"
  | "PARSE_FAILED"
  | "EXTRACTION_FAILED";

/**
 * Custom error class for scraper-related errors
 */
export class ScraperError extends Error {
  constructor(
    public readonly code: ScraperErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ScraperError";
    Error.captureStackTrace?.(this, ScraperError);
  }
}

/**
 * Type guard to check if an error is a ScraperError
 */
export function isScraperError(error: unknown): error is ScraperError {
  return error instanceof ScraperError;
}
