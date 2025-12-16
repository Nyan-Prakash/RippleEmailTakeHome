import type { Browser as PuppeteerBrowser, Page as PuppeteerPage } from "puppeteer-core";

// Re-export types for compatibility
export type Browser = PuppeteerBrowser;
export type Page = PuppeteerPage;

/**
 * Singleton browser instance
 */
let browserInstance: PuppeteerBrowser | null = null;

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
export async function getBrowser(): Promise<PuppeteerBrowser> {
  // Check if browser needs periodic restart (for memory leak prevention)
  if (browserInstance && Date.now() - lastRestartTime > BROWSER_RESTART_INTERVAL) {
    console.log("[Browser] Restarting browser for memory cleanup...");
    await closeBrowser();
  }

  if (!browserInstance) {
    const isVercel = isVercelEnvironment();
    
    if (isVercel) {
      // Vercel/serverless environment - use @sparticuz/chromium-min with puppeteer-core
      console.log("[Browser] Launching browser in Vercel serverless mode...");
      
      try {
        const chromium = await import("@sparticuz/chromium");
        const puppeteer = await import("puppeteer-core");
        
        // Set required environment variables for serverless
        process.env.HOME = '/tmp';
        process.env.FONTCONFIG_PATH = '/tmp';
        
        console.log("[Browser] Getting Chromium executable path...");
        
        // Get the executable path - this will extract chromium to /tmp if needed
        const executablePath = await chromium.default.executablePath();
        
        console.log("[Browser] Chrome executable path:", executablePath);
        console.log("[Browser] Chromium args:", chromium.default.args);
        
        browserInstance = await puppeteer.default.launch({
          args: chromium.default.args,
          executablePath: executablePath,
          headless: true,
        }) as PuppeteerBrowser;
        
        console.log("[Browser] Browser launched successfully in serverless mode");
      } catch (error) {
        console.error("[Browser] Error with @sparticuz/chromium:", error);
        console.error("[Browser] Error message:", (error as Error).message);
        console.error("[Browser] Error stack:", (error as Error).stack);
        throw error;
      }
    } else {
      // Local development - use puppeteer-core with system Chrome
      console.log("[Browser] Launching browser in local development mode...");
      
      // Import puppeteer-core for local development
      const puppeteer = await import("puppeteer-core");
      
      // Try to find Chrome in common locations
      const chromePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
        '/usr/bin/google-chrome', // Linux
        '/usr/bin/chromium-browser', // Linux Chromium
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', // Windows 32-bit
      ];
      
      let executablePath: string | undefined;
      for (const path of chromePaths) {
        try {
          const fs = await import('fs');
          if (fs.existsSync(path)) {
            executablePath = path;
            console.log("[Browser] Found Chrome at:", executablePath);
            break;
          }
        } catch {
          // Continue to next path
        }
      }
      
      if (!executablePath) {
        throw new Error(
          "Chrome not found. Please install Google Chrome or set CHROME_PATH environment variable.\n" +
          "Visit: https://www.google.com/chrome/"
        );
      }
      
      browserInstance = await puppeteer.default.launch({
        executablePath,
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
export async function closePage(page: PuppeteerPage): Promise<void> {
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
}): Promise<PuppeteerPage> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Set user agent
  await page.setUserAgent(
    options?.userAgent ||
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // Set viewport
  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  // Set default timeouts
  page.setDefaultTimeout(options?.timeout ?? 30000);
  page.setDefaultNavigationTimeout(options?.timeout ?? 30000);

  // Block heavy resources to speed up loading and reduce memory usage
  // In serverless environments, this is critical for staying within memory limits
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const resourceType = request.resourceType();
    const url = request.url();

    // Block video, audio, and optionally fonts for performance
    // Keep images as they're needed for product scraping and brand extraction
    if (resourceType === "media" && (url.includes(".mp4") || url.includes(".webm") || url.includes(".mp3") || url.includes(".wav"))) {
      request.abort();
    } else if (isVercelEnvironment() && resourceType === "font") {
      // In serverless, also block fonts to reduce memory/bandwidth
      request.abort();
    } else {
      request.continue();
    }
  });

  // Prevent detection as headless browser
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  return page;
}
