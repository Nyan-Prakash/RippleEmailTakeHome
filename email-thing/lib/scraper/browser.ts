import { chromium, type Browser, type Page } from "playwright";

/**
 * Singleton browser instance
 */
let browserInstance: Browser | null = null;

/**
 * Get or create browser instance
 */
export async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });
  }
  return browserInstance;
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Create a new page with standard settings
 */
export async function newPage(options?: {
  timeout?: number;
  userAgent?: string;
}): Promise<Page> {
  const browser = await getBrowser();
  const page = await browser.newPage({
    userAgent:
      options?.userAgent ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  // Set default timeouts
  page.setDefaultTimeout(options?.timeout ?? 30000);
  page.setDefaultNavigationTimeout(options?.timeout ?? 30000);

  // Block heavy resources to speed up loading (but keep CSS/fonts/scripts)
  await page.route("**/*", (route) => {
    const resourceType = route.request().resourceType();
    // Block media, but allow everything else including CSS, fonts, scripts
    if (resourceType === "media") {
      route.abort();
    } else {
      route.continue();
    }
  });

  return page;
}
