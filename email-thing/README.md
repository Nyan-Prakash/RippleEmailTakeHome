# AI Marketing Email Generator

A production-quality AI system that generates sendable, brand-accurate marketing emails using a structured JSON → renderer architecture. This system demonstrates how LLMs should design _what_ to say and _which components_ to use—not _how pixels are placed_.

## Overview

This project implements a sophisticated email generation pipeline that:

1. Scrapes and analyzes brand websites to extract identity, colors, and voice
2. Interprets natural language campaign prompts into structured intent
3. Plans email structure and content using AI
4. Generates validated JSON specifications (EmailSpec)
5. Renders responsive, email-client-safe HTML via MJML

The system enforces email-safe constraints while giving marketers creative freedom through natural language.

## Current Status

✅ **Fully Implemented (PR0-PR8)**

- **PR0**: Foundation scaffold complete
- **PR1**: Core type system implemented
- **PR2**: Brand scraping engine complete (Playwright + Cheerio)
- **PR3**: Brand ingestion API & UI complete
- **PR4**: Campaign intent parser (LLM) complete
- **PR5**: Email planning layer (LLM) complete
- **PR6**: EmailSpec generation with repair loop (LLM) complete
- **PR7**: Structural validation system complete
- **PR8**: MJML renderer + preview + export complete

The system can now generate complete, sendable marketing emails from a brand URL and natural language prompt. All stages are implemented, tested, and working end-to-end.

## Architecture

```
User Input (Brand URL + Prompt)
  ↓
Brand Scraper (Playwright) → BrandContext
  ↓
Campaign Intent Parser (LLM)
  ↓
Email Planner (LLM)
  ↓
EmailSpec Generator (LLM)
  ↓
Validator + Repair Loop
  ↓
MJML Renderer → HTML
  ↓
Preview + Export
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Tooling**: ESLint + Prettier
- **Package Manager**: pnpm
- **Node Version**: 20+

## Local Development

### Prerequisites

- Node.js >= 20 (use `.nvmrc` for version management)
- pnpm (recommended) or npm

### Setup

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Open browser
# Navigate to http://localhost:3000
```

### Available Scripts

| Script              | Description                      |
| ------------------- | -------------------------------- |
| `pnpm dev`          | Start Next.js development server |
| `pnpm build`        | Build production bundle          |
| `pnpm start`        | Start production server          |
| `pnpm test`         | Run tests with Vitest            |
| `pnpm test:watch`   | Run tests in watch mode          |
| `pnpm lint`         | Run ESLint                       |
| `pnpm format`       | Format code with Prettier        |
| `pnpm format:check` | Check code formatting            |
| `pnpm typecheck`    | Run TypeScript compiler checks   |
| `pnpm scraper:dev`  | Test brand scraper (dev utility) |

## Project Structure

```
email-thing/
├── app/
│   ├── page.tsx              # Main UI (placeholder)
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── api/
│       └── health/
│           └── route.ts      # Health check endpoint
├── lib/
│   ├── types/                # TypeScript type definitions (PR1+)
│   └── utils/                # Utility functions
├── scraper/                  # Brand scraping engine (PR2+)
├── renderer/                 # MJML renderer (PR8+)
├── spec/                     # EmailSpec schema (PR1+)
└── README.md
```

## API Endpoints

### Health Check

```bash
GET /api/health
```

Returns:

```json
{
  "ok": true,
  "ts": "2024-12-12T10:30:00.000Z"
}
```

### Brand Ingestion (PR3)

```bash
POST /api/brand/ingest
Content-Type: application/json

{
  "url": "https://www.allbirds.com"
}
```

Success Response (200):

```json
{
  "brandContext": {
    "brand": {
      "name": "Allbirds",
      "website": "https://www.allbirds.com",
      "logoUrl": "https://...",
      "colors": {
        "primary": "#111111",
        "background": "#ECE9E2",
        "text": "#000000"
      },
      "fonts": {
        "heading": "Geograph",
        "body": "Geograph"
      },
      "voiceHints": ["sustainable", "comfortable", "simple"],
      "snippets": {}
    },
    "catalog": [
      {
        "id": "123",
        "title": "Wool Runners",
        "price": "$98",
        "image": "https://...",
        "url": "https://..."
      }
    ],
    "trust": {}
  }
}
```

Error Response (400/403/429/502/504):

```json
{
  "error": {
    "code": "INVALID_URL" | "BLOCKED_URL" | "SCRAPE_TIMEOUT" | "SCRAPE_FAILED" | "RATE_LIMITED" | "INTERNAL",
    "message": "Human readable error message"
  }
}
```

**Rate Limiting**: 10 requests per minute per IP address (in-memory, no external storage)

### Campaign Intent Parser (PR4)

```bash
POST /api/campaign/intent
Content-Type: application/json

{
  "brandContext": { /* BrandContext from /api/brand/ingest */ },
  "prompt": "make me an email for my 50% sale ending tonight"
}
```

Success Response (200):

```json
{
  "intent": {
    "type": "sale",
    "goal": "Drive urgency for limited-time 50% discount",
    "urgency": "high",
    "timeWindow": {
      "end": "2024-12-13T23:59:59Z"
    },
    "tone": "urgent",
    "cta": {
      "primary": "Shop Sale Now",
      "secondary": "Browse All Deals"
    },
    "offer": {
      "kind": "percent",
      "value": 50,
      "details": "50% off sitewide"
    },
    "keywords": ["sale", "limited-time", "50% off", "tonight", "hurry"],
    "confidence": 0.95,
    "rationale": "Clear sale campaign with specific discount and time urgency"
  }
}
```

Error Response (400/500/502/504):

```json
{
  "error": {
    "code": "INVALID_PROMPT" | "LLM_CONFIG_MISSING" | "LLM_FAILED" | "LLM_TIMEOUT" | "LLM_OUTPUT_INVALID" | "INTERNAL",
    "message": "Human readable error message"
  }
}
```

**Environment Variables**:

- `OPENAI_API_KEY`: Required for LLM-based intent parsing

**Note**: No real LLM calls are made in tests. All tests use mocked LLM clients.

### Email Planning (PR5)

```bash
POST /api/email/plan
Content-Type: application/json

{
  "brandContext": { /* BrandContext */ },
  "intent": { /* CampaignIntent */ }
}
```

Success Response (200):

```json
{
  "plan": {
    "campaignType": "sale",
    "goal": "Drive urgency for limited-time 50% discount",
    "sections": [
      { "type": "header", "variant": "single" },
      { "type": "hero", "variant": "single" },
      { "type": "productGrid", "variant": "grid", "count": 4 },
      { "type": "trustBar", "variant": "single" },
      { "type": "footer", "variant": "single" }
    ]
  }
}
```

### EmailSpec Generation (PR6)

```bash
POST /api/email/spec
Content-Type: application/json

{
  "brandContext": { /* BrandContext */ },
  "intent": { /* CampaignIntent */ },
  "plan": { /* EmailPlan */ }
}
```

Success Response (200):

```json
{
  "spec": {
    "meta": {
      "subject": "⏰ 50% Off Sale Ends Tonight!",
      "preheader": "Last chance to save on everything. Shop now before midnight."
    },
    "theme": { /* theme tokens */ },
    "sections": [ /* complete email structure with blocks */ ],
    "catalog": { "items": [ /* products */ ] }
  },
  "warnings": []
}
```

**Multi-Attempt Repair Loop:**
- Attempt 1: temperature 0.7 (creative)
- Attempt 2: temperature 0.5 (balanced, with errors)
- Attempt 3: temperature 0.3 (precise, with explicit fix instructions)
- Returns `LLM_OUTPUT_INVALID` if all attempts fail

### Email Rendering (PR8)

```bash
POST /api/email/render
Content-Type: application/json

{
  "spec": { /* EmailSpec */ }
}
```

Success Response (200):

```json
{
  "html": "<html>... responsive email HTML ...</html>",
  "mjml": "<mjml>... MJML source ...</mjml>",
  "warnings": [
    {
      "code": "MISSING_COLUMN_SPEC",
      "message": "Section has twoColumn layout but missing columns. Using 50/50 default.",
      "path": "sections.hero.layout"
    }
  ],
  "mjmlErrors": []
}
```

Error Response (400/500/502):

```json
{
  "error": {
    "code": "INVALID_INPUT" | "RENDER_FAILED" | "MJML_COMPILE_FAILED",
    "message": "Human readable error message"
  }
}
```

**Features:**
- Deterministic rendering (same EmailSpec → same HTML)
- MJML compilation (responsive, email-client safe)
- Graceful degradation (warnings for non-fatal issues)
- HTML escaping (XSS prevention)

## Deployment

This project is designed to be deployed on [Vercel](https://vercel.com).

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/email-thing)

Or manually:

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel
```

**Note**: Future PRs will add Playwright for web scraping, which requires specific Vercel configuration (edge functions disabled for those routes).

## Documentation

- **[Technical Specification](./spec/spec.md)** - Comprehensive system design documentation (fully up-to-date)
- **[Block Schemas](./lib/schemas/blocks.ts)** - All 9 atomic block types
- **[EmailSpec Schema](./lib/schemas/emailSpec.ts)** - Canonical email contract
- **[Validation System](./lib/validators/emailSpec.ts)** - Structural validation rules

## Development Philosophy

### Design Principles

1. **LLMs design, renderers enforce**: AI handles content and component selection; the renderer ensures email-client compatibility
2. **JSON as contract**: All LLM outputs are validated JSON schemas, never raw HTML
3. **Deterministic rendering**: Same EmailSpec always produces the same HTML
4. **Type safety first**: Strict TypeScript, no `any` types
5. **Testing over debugging**: Schemas validate at every stage

### Non-Goals

- Direct ESP (Email Service Provider) integration
- Authentication or user management
- Analytics or tracking
- Image generation (stretch goal)
- Multi-language support

## Implementation Status

**Core System (Complete):**
- ✅ **PR0**: Repo & Tooling Scaffold
- ✅ **PR1**: Core Type System & Contracts
- ✅ **PR2**: Brand Scraping Engine (Playwright)
- ✅ **PR3**: Brand Ingestion API
- ✅ **PR4**: Campaign Intent Parser (LLM)
- ✅ **PR5**: Email Planning Layer (LLM)
- ✅ **PR6**: EmailSpec Generator (LLM + Repair Loop)
- ✅ **PR7**: Structural Validation
- ✅ **PR8**: MJML Renderer + Preview + Export

**Future Enhancements (Roadmap):**
- 🔲 User authentication & accounts
- 🔲 Redis-backed caching
- 🔲 ESP integrations (Mailchimp, Sendgrid)
- 🔲 Template gallery
- 🔲 A/B testing variants
- 🔲 AI image generation

## Contributing

This is a take-home project demonstrating production-grade systems thinking. Each PR is:

- Independently reviewable
- Type-safe
- Covered by tests or runtime assertions
- Scoped to avoid scope creep

## License

MIT License - See LICENSE file for details

## Contact

For questions about this implementation, please refer to the technical specification or PR roadmap documentation.

---

**Built with ❤️ as a demonstration of production-quality AI system design**
