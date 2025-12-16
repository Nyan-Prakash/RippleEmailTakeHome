import { chromium, type Browser, type Page } from "playwright";

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
 * Detect if running in a production/render environment
 */
function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production" || process.env.RENDER === "true";
}

/**
 * Get or create browser instance
 */
export async function getBrowser(): Promise<Browser> {
  // Check if browser needs periodic restart (for memory leak prevention)
  if (browserInstance && Date.now() - lastRestartTime > BROWSER_RESTART_INTERVAL) {
    console.log("[Browser] Restarting browser for memory cleanup...");
    await closeBrowser();
  }

  if (!browserInstance) {
    const isProduction = isProductionEnvironment();
    
    console.log(`[Browser] Launching browser in ${isProduction ? 'production' : 'development'} mode...`);
    
    const launchOptions = {
      headless: true,
      args: [
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process", // Important for Render
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-client-side-phishing-detection",
        "--disable-component-extensions-with-background-pages",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-features=TranslateUI",
        "--disable-hang-monitor",
        "--disable-ipc-flooding-protection",
        "--disable-popup-blocking",
        "--disable-prompt-on-repost",
        "--disable-renderer-backgrounding",
        "--disable-sync",
        "--force-color-profile=srgb",
        "--metrics-recording-only",
        "--mute-audio",
      ],
    };
    
    browserInstance = await chromium.launch(launchOptions);
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
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Close a page instance to free up memory
 * In production environments, close pages after use instead of the entire browser
 */
export async function closePage(page: Page): Promise<void> {
  try {
    await page.close();
  } catch (error) {
    console.warn("[Browser] Error closing page:", error);
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

  // Block heavy resources to speed up loading (but keep images for product scraping)
  // Only block video/audio media
  await page.route("**/*", (route) => {
    const resourceType = route.request().resourceType();
    const url = route.request().url();

    // Block video and audio media, but ALLOW images
    if (resourceType === "media" && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mp3") || url.includes(".wav"))) {
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
