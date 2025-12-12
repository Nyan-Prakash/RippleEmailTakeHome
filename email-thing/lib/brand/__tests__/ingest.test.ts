/**
 * PR3: Tests for brand ingestion logic
 */

import { describe, it, expect, vi } from "vitest";
import {
  validateIngestRequest,
  ingestBrand,
  formatErrorResponse,
  ApiError,
  isApiError,
} from "../ingest";
import { ScraperError } from "../../scraper/errors";
import type { BrandContext } from "../../types";

describe("validateIngestRequest", () => {
  it("should validate valid URL", () => {
    const result = validateIngestRequest({
      url: "https://example.com",
    });
    expect(result.url).toBe("https://example.com");
  });

  it("should reject empty URL", () => {
    expect(() => validateIngestRequest({ url: "" })).toThrow(ApiError);
    try {
      validateIngestRequest({ url: "" });
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      if (isApiError(err)) {
        expect(err.code).toBe("INVALID_URL");
      }
    }
  });

  it("should reject missing URL", () => {
    expect(() => validateIngestRequest({})).toThrow(ApiError);
    try {
      validateIngestRequest({});
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      if (isApiError(err)) {
        expect(err.code).toBe("INVALID_URL");
      }
    }
  });

  it("should reject invalid URL format", () => {
    expect(() => validateIngestRequest({ url: "not-a-url" })).toThrow(ApiError);
    try {
      validateIngestRequest({ url: "not-a-url" });
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      if (isApiError(err)) {
        expect(err.code).toBe("INVALID_URL");
      }
    }
  });
});

describe("ingestBrand", () => {
  it("should return BrandContext on success", async () => {
    const mockBrandContext: BrandContext = {
      brand: {
        name: "Test Brand",
        website: "https://example.com",
        logoUrl: "https://example.com/logo.png",
        colors: {
          primary: "#111111",
          background: "#FFFFFF",
          text: "#000000",
        },
        fonts: {
          heading: "Arial",
          body: "Arial",
        },
        voiceHints: [],
        snippets: {},
      },
      catalog: [],
      trust: {},
    };

    const mockScraper = vi.fn().mockResolvedValue(mockBrandContext);

    const result = await ingestBrand("https://example.com", mockScraper);

    expect(result).toEqual(mockBrandContext);
    expect(mockScraper).toHaveBeenCalledWith("https://example.com");
  });

  it("should map BLOCKED_URL scraper error to API error", async () => {
    const mockScraper = vi
      .fn()
      .mockRejectedValue(new ScraperError("BLOCKED_URL", "Private IP blocked"));

    await expect(ingestBrand("https://localhost", mockScraper)).rejects.toThrow(
      ApiError
    );

    try {
      await ingestBrand("https://localhost", mockScraper);
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      if (isApiError(err)) {
        expect(err.code).toBe("BLOCKED_URL");
      }
    }
  });

  it("should map TIMEOUT scraper error to SCRAPE_TIMEOUT", async () => {
    const mockScraper = vi
      .fn()
      .mockRejectedValue(new ScraperError("TIMEOUT", "Scraping timed out"));

    await expect(
      ingestBrand("https://example.com", mockScraper)
    ).rejects.toThrow(ApiError);

    try {
      await ingestBrand("https://example.com", mockScraper);
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      if (isApiError(err)) {
        expect(err.code).toBe("SCRAPE_TIMEOUT");
      }
    }
  });

  it("should map extraction errors to SCRAPE_FAILED", async () => {
    const mockScraper = vi
      .fn()
      .mockRejectedValue(
        new ScraperError("EXTRACTION_FAILED", "Failed to extract")
      );

    await expect(
      ingestBrand("https://example.com", mockScraper)
    ).rejects.toThrow(ApiError);

    try {
      await ingestBrand("https://example.com", mockScraper);
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      if (isApiError(err)) {
        expect(err.code).toBe("SCRAPE_FAILED");
      }
    }
  });

  it("should handle unexpected errors", async () => {
    const mockScraper = vi.fn().mockRejectedValue(new Error("Unexpected"));

    await expect(
      ingestBrand("https://example.com", mockScraper)
    ).rejects.toThrow(ApiError);

    try {
      await ingestBrand("https://example.com", mockScraper);
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      if (isApiError(err)) {
        expect(err.code).toBe("INTERNAL");
      }
    }
  });
});

describe("formatErrorResponse", () => {
  it("should format ApiError correctly", () => {
    const error = new ApiError("INVALID_URL", "Invalid URL format");
    const response = formatErrorResponse(error);

    expect(response).toEqual({
      error: {
        code: "INVALID_URL",
        message: "Invalid URL format",
      },
    });
  });

  it("should format unexpected errors as INTERNAL", () => {
    const error = new Error("Something went wrong");
    const response = formatErrorResponse(error);

    expect(response).toEqual({
      error: {
        code: "INTERNAL",
        message: "An unexpected error occurred",
      },
    });
  });

  it("should not leak error details in production", () => {
    const error = new Error("Sensitive stack trace information");
    const response = formatErrorResponse(error);

    expect(response.error.message).not.toContain("stack");
    expect(response.error.message).toBe("An unexpected error occurred");
  });
});
