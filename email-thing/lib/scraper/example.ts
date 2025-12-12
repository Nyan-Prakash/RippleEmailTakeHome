/**
 * Example: Using the scrapeBrand function
 * This demonstrates how to integrate the scraper into your application
 */

import { scrapeBrand, closeBrowser } from "./index";

async function exampleUsage() {
  try {
    // Scrape a brand's website
    const brandContext = await scrapeBrand("https://www.allbirds.com");

    // Access brand information
    console.log("Brand Name:", brandContext.brand.name);
    console.log("Website:", brandContext.brand.website);
    console.log("Logo:", brandContext.brand.logoUrl);

    // Access brand colors
    console.log("\nBrand Colors:");
    console.log("  Primary:", brandContext.brand.colors.primary);
    console.log("  Background:", brandContext.brand.colors.background);
    console.log("  Text:", brandContext.brand.colors.text);

    // Access brand fonts
    console.log("\nBrand Fonts:");
    console.log("  Heading:", brandContext.brand.fonts.heading);
    console.log("  Body:", brandContext.brand.fonts.body);

    // Access voice hints for LLM prompting
    console.log("\nVoice Hints:");
    brandContext.brand.voiceHints.forEach((hint, i) => {
      console.log(`  ${i + 1}. ${hint}`);
    });

    // Access product catalog
    console.log(`\nProduct Catalog (${brandContext.catalog.length} products):`);
    brandContext.catalog.slice(0, 3).forEach((product) => {
      console.log(`  - ${product.title} (${product.price})`);
    });

    // The BrandContext is now ready to be:
    // 1. Stored in a database/cache (PR3)
    // 2. Passed to an LLM for content generation (PR4+)
    // 3. Used to generate email campaigns (PR5+)

    return brandContext;
  } catch (error) {
    console.error("Error scraping brand:", error);
    throw error;
  } finally {
    // Clean up browser resources
    await closeBrowser();
  }
}

// Only run if executed directly
if (require.main === module) {
  exampleUsage()
    .then(() => console.log("\nDone!"))
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}

export { exampleUsage };
