import type { Page } from "playwright";
import { ScraperError } from "./errors";

/**
 * Result of loading HTML
 */
export interface LoadHtmlResult {
  html: string;
  finalUrl: string;
}

/**
 * Load HTML from a URL using Playwright
 */
export async function loadHtml(
  page: Page,
  url: string,
  options?: {
    timeout?: number;
    waitForNetworkIdle?: boolean;
  }
): Promise<LoadHtmlResult> {
  try {
    // Navigate to URL
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options?.timeout ?? 30000,
    });

    if (!response) {
      throw new ScraperError(
        "NAVIGATION_FAILED",
        `No response received for ${url}`
      );
    }

    if (!response.ok()) {
      throw new ScraperError(
        "NAVIGATION_FAILED",
        `HTTP ${response.status()} for ${url}`
      );
    }

    // Optional: wait a bit for network idle (capped at 2 seconds)
    if (options?.waitForNetworkIdle) {
      try {
        await page.waitForLoadState("networkidle", { timeout: 2000 });
      } catch {
        // Ignore timeout, 2s is just a nice-to-have
      }
    }

    // Get final URL (after redirects) and HTML
    const finalUrl = page.url();
    const html = await page.content();

    return { html, finalUrl };
  } catch (err) {
    if (err instanceof ScraperError) {
      throw err;
    }
    throw new ScraperError(
      "NAVIGATION_FAILED",
      `Failed to load ${url}: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetries<T>(
  fn: () => Promise<T>,
  attempts = 2
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Don't retry on validation errors or blocked URLs
      if (
        err instanceof ScraperError &&
        (err.code === "INVALID_URL" || err.code === "BLOCKED_URL")
      ) {
        throw err;
      }
      // Wait before retrying (exponential backoff)
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError;
}
