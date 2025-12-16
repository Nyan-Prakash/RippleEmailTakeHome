import type { Page } from "./browser";
import { ScraperError } from "./errors";

/**
 * Result of loading HTML
 */
export interface LoadHtmlResult {
  html: string;
  finalUrl: string;
}

/**
 * Load HTML from a URL using Puppeteer
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
        await page.waitForNetworkIdle({ timeout: 2000 });
      } catch {
        // Ignore timeout, 2s is just a nice-to-have
      }
    }

    // Wait for common e-commerce elements to ensure dynamic content loads
    try {
      await waitForDynamicContent(page);
    } catch {
      // Ignore errors, this is a best-effort enhancement
    }

    // Trigger lazy-loaded images by scrolling
    try {
      await triggerLazyLoad(page);
    } catch {
      // Ignore errors, this is a best-effort enhancement
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
 * Wait for dynamic content to load (React, Vue, etc.)
 */
async function waitForDynamicContent(page: Page): Promise<void> {
  try {
    // Wait for any of these common selectors that indicate content is loaded
    const contentSelectors = [
      'img',
      '[class*="product"]',
      'main',
      '[role="main"]',
      'article',
    ];

    // Try to wait for at least one of these selectors (with short timeout)
    for (const selector of contentSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 1000 });
        break;
      } catch {
        // Try next selector
      }
    }

    // Give a small additional delay for JavaScript frameworks to finish rendering
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch {
    // Ignore errors
  }
}

/**
 * Trigger lazy-loaded images by scrolling the page
 */
async function triggerLazyLoad(page: Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      // Scroll to trigger lazy loading
      const scrollHeight = document.body.scrollHeight;
      const viewportHeight = window.innerHeight;

      // Scroll in steps to trigger lazy load
      for (let i = 0; i < scrollHeight; i += viewportHeight / 2) {
        window.scrollTo(0, i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Scroll back to top
      window.scrollTo(0, 0);

      // Force load images with data-src attributes
      const lazyImages = document.querySelectorAll('img[data-src], img[data-original], img[data-lazy]');
      lazyImages.forEach((img: any) => {
        if (!img.src && img.dataset.src) {
          img.src = img.dataset.src;
        }
        if (!img.src && img.dataset.original) {
          img.src = img.dataset.original;
        }
        if (!img.src && img.dataset.lazy) {
          img.src = img.dataset.lazy;
        }
      });
    });

    // Wait a bit for images to start loading
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch {
    // Ignore errors
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
