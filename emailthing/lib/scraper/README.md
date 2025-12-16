# Brand Scraper (PR2)

Web scraping and brand ingestion module for the AI Marketing Email Generator.

## Overview

This module implements deterministic web scraping to extract brand context from e-commerce websites. It uses Playwright for JS-rendered sites and follows strict page limits and extraction rules defined in the spec.

## Features

- **Playwright-based scraping** for modern JS-rendered sites
- **SSRF protection** blocks private/localhost URLs
- **Strict page limits**: homepage + ≤1 collection + ≤4 product pages
- **Deterministic extraction** for:
  - Brand name, logo, colors, fonts
  - Voice signals (headlines, CTAs, taglines)
  - Product catalog (max 8 products)
- **Safe fallbacks** on failure
- **Schema validation** via Zod

## Usage

### In Code

```typescript
import { scrapeBrand } from "./lib/scraper";

const brandContext = await scrapeBrand("https://example.com");
console.log(brandContext.brand.name);
console.log(brandContext.catalog.length);
```

### Dev Harness

Test the scraper manually:

```bash
pnpm scraper:dev -- https://allbirds.com
pnpm scraper:dev -- https://www.warbyparker.com
```

## Architecture

```
scraper/
├── index.ts              # Main scrapeBrand() orchestration
├── errors.ts             # ScraperError types
├── url.ts                # URL validation & SSRF protection
├── browser.ts            # Playwright lifecycle
├── fetch.ts              # Page loading with retries
├── discover.ts           # Link discovery logic
├── extract/              # Extraction modules
│   ├── brandName.ts
│   ├── logo.ts
│   ├── colors.ts
│   ├── fonts.ts
│   ├── voice.ts
│   └── products.ts
├── __tests__/            # Unit tests
├── __fixtures__/         # Test HTML fixtures
└── dev.ts                # Dev harness script
```

## Extraction Rules

### Brand Name

1. `og:site_name` meta tag
2. `<title>` tag (cleaned)
3. Hostname fallback

### Logo

1. `<img>` with "logo" in class/id
2. `<img>` with brand name in alt
3. Favicon fallback

### Colors

- CSS variables (`--primary`, `--accent`)
- Computed button/CTA colors
- Filters near-white/near-black for primary

### Fonts

- Computed `font-family` on body and headings
- Ignores system defaults
- Fallback: "Arial, sans-serif"

### Voice Signals

- Hero headlines (h1/h2)
- CTA button text
- Taglines
- Dedupe and cap at 5-10 samples

### Products

- JSON-LD structured data preferred
- DOM extraction fallback
- Max 8 products total

## Page Selection Strategy

1. Load homepage
2. Discover collection/product links via:
   - URL patterns (`/products/`, `/collections/`)
   - JSON-LD structured data
3. Load ≤1 collection page (best match)
4. Load ≤4 product pages (ranked by score)

## Timeouts & Safety

- Overall budget: ~10 seconds
- Page timeouts: 8s (homepage), 3s (collection), 2s (products)
- Blocks private IPs: localhost, 127.0.0.1, 10.x, 192.168.x, etc.
- Safe fallback BrandContext on any failure

## Testing

```bash
# Run all scraper tests
pnpm test lib/scraper/__tests__

# Run specific test file
pnpm test lib/scraper/__tests__/brandName.test.ts
```

## Dependencies

- `playwright`: Headless browser
- `cheerio`: HTML parsing
- `nanoid`: Product ID generation

## Non-Goals (Future PRs)

- ❌ Caching (PR3)
- ❌ LLM calls (PR4+)
- ❌ Email rendering (PR8)
