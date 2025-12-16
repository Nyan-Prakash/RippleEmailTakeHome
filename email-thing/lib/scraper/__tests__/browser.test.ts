/**
 * Browser module compatibility test
 * Tests both local and serverless browser initialization
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getBrowser, closeBrowser, newPage, closePage } from "../browser";

describe("Browser Module - Vercel Compatibility", () => {
  afterAll(async () => {
    await closeBrowser();
  });

  it("should initialize browser in current environment", async () => {
    const browser = await getBrowser();
    expect(browser).toBeDefined();
    expect(browser.isConnected()).toBe(true);
  });

  it("should create a new page with standard settings", async () => {
    const page = await newPage();
    expect(page).toBeDefined();
    expect(page.url()).toBe("about:blank");
    await closePage(page);
  });

  it("should navigate to a website and extract content", async () => {
    const page = await newPage({ timeout: 10000 });
    
    try {
      await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
      const title = await page.title();
      expect(title).toContain("Example");
      
      const content = await page.content();
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
    } finally {
      await closePage(page);
    }
  });

  it("should reuse browser instance across multiple page creations", async () => {
    const browser1 = await getBrowser();
    const page1 = await newPage();
    await closePage(page1);
    
    const browser2 = await getBrowser();
    expect(browser2).toBe(browser1); // Should be the same instance
  });

  it("should handle multiple concurrent pages", async () => {
    const page1 = await newPage();
    const page2 = await newPage();
    
    expect(page1).toBeDefined();
    expect(page2).toBeDefined();
    expect(page1).not.toBe(page2);
    
    await closePage(page1);
    await closePage(page2);
  });
});
