/**
 * Type definitions and interfaces used across the application
 * Re-exports all types and schemas from the schemas module
 */

// Re-export all schemas and inferred types
export * from "../schemas";

// Re-export normalizers
export { normalizeBrandContext } from "../normalize/brandContext";
export { normalizeEmailSpec } from "../normalize/emailSpec";

// Re-export validators
export { validateEmailSpecStructure } from "../validators/emailSpec";
export type {
  ValidationIssue,
  ValidationResult,
} from "../validators/emailSpec";

// Re-export scraper (PR2)
export { scrapeBrand, closeBrowser } from "../scraper";
export { ScraperError, isScraperError } from "../scraper/errors";
export type { ScraperErrorCode } from "../scraper/errors";
