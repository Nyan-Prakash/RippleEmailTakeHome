#!/usr/bin/env node

/**
 * Development harness for testing the scraper
 * Usage: pnpm scraper:dev -- https://example.com
 */

import { scrapeBrand, closeBrowser } from "./index";

async function main() {
  // Skip the "--" that pnpm adds
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const url = args[0];

  if (!url) {
    console.error("Usage: pnpm scraper:dev <url>");
    console.error("Example: pnpm scraper:dev https://allbirds.com");
    process.exit(1);
  }

  console.log(`\nScraping: ${url}\n`);

  try {
    const startTime = Date.now();
    const brandContext = await scrapeBrand(url);
    const elapsed = Date.now() - startTime;

    console.log("✅ Success! Scraped in", elapsed, "ms\n");

    console.log("=== BRAND INFO ===");
    console.log("Name:", brandContext.brand.name);
    console.log("Website:", brandContext.brand.website);
    console.log("Logo:", brandContext.brand.logoUrl || "(none)");

    console.log("\n=== COLORS ===");
    console.log("Primary:", brandContext.brand.colors.primary);
    console.log("Background:", brandContext.brand.colors.background);
    console.log("Text:", brandContext.brand.colors.text);

    console.log("\n=== FONTS ===");
    console.log("Heading:", brandContext.brand.fonts.heading);
    console.log("Body:", brandContext.brand.fonts.body);

    console.log("\n=== VOICE HINTS ===");
    if (brandContext.brand.voiceHints.length > 0) {
      brandContext.brand.voiceHints.slice(0, 5).forEach((hint, i) => {
        console.log(`${i + 1}. ${hint}`);
      });
    } else {
      console.log("(none)");
    }

    console.log("\n=== SNIPPETS ===");
    if (brandContext.brand.snippets.tagline) {
      console.log("Tagline:", brandContext.brand.snippets.tagline);
    }
    if (brandContext.brand.snippets.headlines?.length) {
      console.log(
        "Headlines:",
        brandContext.brand.snippets.headlines.slice(0, 2).join(", ")
      );
    }
    if (brandContext.brand.snippets.ctas?.length) {
      console.log(
        "CTAs:",
        brandContext.brand.snippets.ctas.slice(0, 3).join(", ")
      );
    }

    console.log("\n=== PRODUCTS ===");
    console.log(`Found ${brandContext.catalog.length} products`);
    if (brandContext.catalog.length > 0) {
      console.log("\nFirst 2 products:");
      brandContext.catalog.slice(0, 2).forEach((product, i) => {
        console.log(`\n${i + 1}. ${product.title}`);
        console.log(`   Price: ${product.price}`);
        console.log(`   Image: ${product.image.substring(0, 60)}...`);
        console.log(`   URL: ${product.url}`);
      });
    }

    console.log("\n");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

main();
