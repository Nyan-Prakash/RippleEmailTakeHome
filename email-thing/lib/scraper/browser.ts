import type { Browser, Page } from "playwright-core";

/**
 * Singleton browser instance
 */
let browserInstance: Browser | null = null;

/**
 * Last browser restart time for periodic cleanup
 */
let lastRestartTime: number = Date.now();

/**
 * Browser restart interval (10 minutes)
 */
const BROWSER_RESTART_INTERVAL = 10 * 60 * 1000;

/**
 * Detect if running in Vercel serverless environment
 */
function isVercelEnvironment(): boolean {
  return process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
}

/**
 * Get or create browser instance with Vercel compatibility
 */
export async function getBrowser(): Promise<Browser> {
  // Check if browser needs periodic restart (for memory leak prevention)
  if (browserInstance && Date.now() - lastRestartTime > BROWSER_RESTART_INTERVAL) {
    console.log("[Browser] Restarting browser for memory cleanup...");
    await closeBrowser();
  }

  if (!browserInstance) {
    const isVercel = isVercelEnvironment();
    
    if (isVercel) {
      // Vercel/serverless environment - use @sparticuz/chromium
      console.log("[Browser] Launching browser in Vercel serverless mode...");
      
      // Import chromium binary and playwright-core
      const chromiumBinary = await import("@sparticuz/chromium");
      const { chromium } = await import("playwright-core");
      
      try {
        // Get the executable path - this handles decompression automatically
        // The package will decompress to /tmp which is writable in Lambda/Vercel
        const executablePath = await chromiumBinary.default.executablePath();
        
        console.log("[Browser] Chromium executable path:", executablePath);
        
        browserInstance = await chromium.launch({
          args: chromiumBinary.default.args,
          executablePath: executablePath,
          headless: true,
        });
      } catch (error) {
        console.error("[Browser] Error with @sparticuz/chromium:", error);
        console.error("[Browser] Error message:", (error as Error).message);
        console.error("[Browser] This may be due to missing binary files in the deployment bundle");
        throw error;
      }
    } else {
      // Local development - use local Playwright Chromium
      console.log("[Browser] Launching browser in local development mode...");
      
      // Import regular playwright for local development
      const { chromium: localChromium } = await import("playwright");
      
      browserInstance = await localChromium.launch({
        headless: true,
        args: [
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--disable-setuid-sandbox",
        ],
      });
    }
    
    lastRestartTime = Date.now();
    console.log("[Browser] Browser instance created successfully");
  }
  
  return browserInstance;
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    try {
      await browserInstance.close();
      console.log("[Browser] Browser instance closed successfully");
    } catch (error) {
      console.error("[Browser] Error closing browser:", error);
    } finally {
      browserInstance = null;
      lastRestartTime = Date.now();
    }
  }
}

/**
 * Close a page instance to free up memory
 * In serverless environments, close pages after use instead of the entire browser
 */
export async function closePage(page: Page): Promise<void> {
  try {
    await page.close();
  } catch (error) {
    console.error("[Browser] Error closing page:", error);
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
    viewport: {
      width: 1920,
      height: 1080,
    },
  });

  // Set default timeouts
  page.setDefaultTimeout(options?.timeout ?? 30000);
  page.setDefaultNavigationTimeout(options?.timeout ?? 30000);

  // Block heavy resources to speed up loading and reduce memory usage
  // In serverless environments, this is critical for staying within memory limits
  await page.route("**/*", (route) => {
    const resourceType = route.request().resourceType();
    const url = route.request().url();

    // Block video, audio, and optionally fonts for performance
    // Keep images as they're needed for product scraping and brand extraction
    if (resourceType === "media" && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mp3") || url.includes(".wav"))) {
      route.abort();
    } else if (isVercelEnvironment() && resourceType === "font") {
      // In serverless, also block fonts to reduce memory/bandwidth
      route.abort();
    } else {
      route.continue();
    }
  });

  // Enable JavaScript execution
  await page.addInitScript(() => {
    // Prevent detection as headless browser
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  return page;
}
