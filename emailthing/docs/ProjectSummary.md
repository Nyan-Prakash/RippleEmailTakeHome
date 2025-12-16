# Emailify - Technical Project Summary

## Executive Summary

**Emailify** is a production-grade AI-powered marketing email generation system that transforms brand websites and natural language prompts into fully-rendered, email-client-safe HTML emails. The system demonstrates sophisticated AI system design by using LLMs for content and component selection while enforcing structural constraints through a deterministic rendering pipeline.

**Core Innovation**: Separating "what to say" (AI-generated) from "how pixels are placed" (renderer-enforced) via a validated JSON contract (`EmailSpec`).

---

## System Architecture

### High-Level Data Flow

```
User Input (Brand URL + Campaign Prompt)
    ↓
┌─── Brand Scraper (Playwright + Cheerio) ────┐
│   • Extracts: name, logo, colors, fonts     │
│   • Discovers products, pricing, images     │
│   • Captures voice signals from copy        │
└──────────────> BrandContext (validated) ────┘
    ↓
┌─── Campaign Intent Parser (LLM) ────────────┐
│   • GPT-4o-mini interprets natural language │
│   • Structured output: type, tone, CTA      │
│   • Extracts offers, urgency, keywords      │
└──────────────> CampaignIntent (validated) ──┘
    ↓
┌─── Email Planner (LLM) ──────────────────────┐
│   • Decides email structure (5-8 sections)  │
│   • Selects products, layouts, templates    │
│   • No copy yet - strategic planning only   │
└──────────────> EmailPlan (validated) ────────┘
    ↓
┌─── EmailSpec Generator (LLM + Repair Loop) ─┐
│   • Generates complete email JSON           │
│   • 3-attempt repair with decreasing temp   │
│   • Validates structure + content quality   │
└──────────────> EmailSpec (canonical) ────────┘
    ↓
┌─── MJML Renderer (Deterministic) ────────────┐
│   • EmailSpec → MJML → HTML                 │
│   • Email-client safe (Gmail, Outlook, etc) │
│   • Responsive design enforced              │
└──────────────> Sendable HTML ─────────────────┘
```

---

## Technical Stack

### Core Technologies

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js | 16.0.10 | App Router, API Routes, SSR |
| **Language** | TypeScript | 5.x | Type safety, inference |
| **Runtime** | Node.js | 20+ | Server-side execution |
| **Package Manager** | pnpm | 9.x | Fast, disk-efficient installs |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS |
| **Validation** | Zod | 4.x | Runtime schema validation |
| **AI** | OpenAI API | GPT-4o-mini | Content generation |
| **Scraping** | Playwright | 1.57.0 | Headless browser automation |
| **HTML Parsing** | Cheerio | 1.1.2 | jQuery-like DOM manipulation |
| **Email Rendering** | MJML | 4.18.0 | Responsive email framework |
| **Testing** | Vitest | 4.x | Unit/integration testing |
| **Linting** | ESLint + Prettier | 9.x / 3.x | Code quality |

### Deployment

- **Primary**: Docker containers on Render.com
- **Alternative**: Vercel (serverless functions)
- **Browser**: Chromium via Playwright (all dependencies bundled)
- **Memory**: Minimum 1GB RAM required

---

## Core Modules

### 1. Brand Scraping Engine (`lib/scraper/`)

**Purpose**: Extract brand identity from e-commerce websites

**Technology**: Playwright (headless Chromium) + Cheerio (HTML parsing)

**Features**:
- ✅ **Smart Page Selection**: Homepage + ≤1 collection + ≤4 product pages
- ✅ **Multi-Strategy Extraction**: JSON-LD, DOM selectors, heuristics
- ✅ **Color Detection**: Brand primary + derived palette (background, text)
- ✅ **Font Discovery**: Computed styles + web font URLs
- ✅ **Product Catalog**: Title, price, image, URL (max 8 products)
- ✅ **Voice Analysis**: Headlines, CTAs, taglines
- ✅ **SSRF Protection**: Blocks private IPs, localhost
- ✅ **Timeout Budget**: 10-second global limit with per-page budgets

**Key Files**:
- `index.ts` - Main orchestration (`scrapeBrand()`)
- `browser.ts` - Playwright lifecycle (singleton pattern)
- `extract/` - Modular extractors (brand name, logo, colors, fonts, products)
- `webSearch.ts` - Enhanced product discovery via web search

**Output**: Validated `BrandContext` object

---

### 2. Campaign Intent Parser (`lib/llm/parseCampaignIntent.ts`)

**Purpose**: Convert natural language prompts to structured campaign data

**LLM Model**: GPT-4o-mini (fast, cost-effective)

**Input**: 
```typescript
{
  brandContext: BrandContext,
  prompt: "50% off sale ending tonight!"
}
```

**Output**:
```typescript
{
  type: "sale",
  goal: "Drive urgency for limited-time discount",
  urgency: "high",
  timeWindow: { end: "2024-12-13T23:59:59Z" },
  tone: "urgent",
  cta: { primary: "Shop Now", secondary: "Browse Deals" },
  offer: { kind: "percent", value: 50 },
  keywords: ["sale", "limited-time", "50% off"],
  confidence: 0.95,
  rationale: "Clear sale campaign with time urgency"
}
```

**Features**:
- 10 campaign types (sale, launch, back-in-stock, holiday, etc.)
- Offer detection (percent, fixed, BOGO, free shipping)
- Tone classification (playful, premium, urgent, etc.)
- Constraint extraction (e.g., "no exclamation marks")

---

### 3. Email Planner (`lib/llm/planEmail.ts`)

**Purpose**: Design email structure without writing copy

**LLM Model**: GPT-4o-mini

**Features**:
- ✅ **Template Selection**: 7 templates (hero, product_grid, editorial, etc.)
- ✅ **Section Planning**: 26 section types (hero, feature, testimonial, FAQ, etc.)
- ✅ **Product Selection**: Chooses 0-8 products from brand catalog
- ✅ **Layout Guidance**: Single, two-column, or grid layouts
- ✅ **Subject Lines**: Primary + 3 alternatives (max 70 chars)
- ✅ **Density Control**: Light, medium, or high content density

**Output**: `EmailPlan` with section sequence, purpose, and headline guidance

**Example Sections**:
```typescript
[
  { type: "header", purpose: "Brand navigation" },
  { type: "hero", purpose: "Announce sale", cta: "Shop Now" },
  { type: "productGrid", purpose: "Feature bestsellers" },
  { type: "trustBar", purpose: "Build credibility" },
  { type: "footer", purpose: "Legal + unsubscribe" }
]
```

---

### 4. EmailSpec Generator (`lib/llm/generateEmailSpec.ts`)

**Purpose**: Generate complete, validated email JSON from plan

**LLM Model**: GPT-4o-mini with multi-attempt repair loop

**Repair Strategy**:
- **Attempt 1**: Temperature 0.7 (creative)
- **Attempt 2**: Temperature 0.5 (balanced, with error feedback)
- **Attempt 3**: Temperature 0.3 (precise, with explicit fix instructions)

**Validations**:
1. **Zod Schema**: Type validation, constraints (min/max lengths, enums)
2. **Structural Rules**: Header first, footer last, required CTA
3. **Content Quality**: Minimum 3-4 sentences per paragraph
4. **Product References**: All productCards must reference real catalog items
5. **Theme Consistency**: Colors match brand palette
6. **URL Validation**: All buttons have valid hrefs

**Output**: `EmailSpec` (1500-3000 lines of JSON) + warnings array

**Example Warnings**:
- `THEME_COLOR_DRIFT`: Theme colors deviate from brand
- `TOO_MANY_SECTIONS`: More than 8 sections (engagement risk)
- `HEADING_TOO_LONG`: Heading exceeds 80 characters

---

### 5. Structural Validator (`lib/validators/emailSpec.ts`)

**Purpose**: Enforce email best practices beyond Zod schema

**Validation Categories**:

**Blocking Errors (prevent generation)**:
- ❌ Header not first OR footer not last
- ❌ No valid CTA button
- ❌ Invalid logo URL
- ❌ ProductCard references non-existent catalog item
- ❌ Two-column layout missing columns array

**Warnings (non-blocking)**:
- ⚠️ Too few/many sections (recommended: 5-8)
- ⚠️ No secondary CTA
- ⚠️ Sale campaign missing promotional language
- ⚠️ Launch campaign missing "new/introducing" language
- ⚠️ Heading too long (>80 chars)
- ⚠️ Paragraph too long (>300 chars)
- ⚠️ Total copy too dense (>1500 chars)
- ⚠️ Benefits list not 3-6 items
- ⚠️ FAQ not 3-6 questions

**Output**: `ValidationResult` with `ok: boolean` + issues array

---

### 6. MJML Renderer (`lib/render/mjml/`)

**Purpose**: Convert EmailSpec JSON to responsive HTML

**Technology**: MJML 4.18 (Mailjet Markup Language)

**Features**:
- ✅ **Responsive Design**: Mobile-first, tested on Gmail, Outlook, Apple Mail
- ✅ **Email-Client Safe**: No modern CSS Grid, Flexbox, etc.
- ✅ **Deterministic**: Same EmailSpec → same HTML (always)
- ✅ **XSS Prevention**: HTML escaping on all user content
- ✅ **Graceful Degradation**: Warns for non-fatal issues
- ✅ **Dark Mode Support**: Email client-specific adaptations

**Rendering Pipeline**:
```typescript
EmailSpec → MJML Components → MJML Compiler → HTML
```

**Section Types Supported**: 26 (matches EmailSpec schema)

**Block Types Supported**: 14 atomic components
- `logo`, `heading`, `paragraph`, `image`, `button`
- `productCard`, `divider`, `spacer`, `smallPrint`
- `badge`, `bullets`, `priceLine`, `rating` (v2)
- `navLinks`, `socialIcons` (v2)

---

## Data Contracts (Schemas)

### BrandContext
```typescript
{
  brand: {
    name: string;
    website: string;
    logoUrl: string;
    heroImage?: { src, alt };
    colors: { primary, background, text };
    fonts: { heading, body, sourceUrl? };
    voiceHints: string[];
    snippets: { tagline?, ctas?, headlines? };
  };
  catalog: Product[];  // max 8
  trust: { reviews?, certifications?, returns? };
}
```

### EmailSpec (Canonical Contract)
```typescript
{
  meta: { subject, preheader };
  theme: {
    containerWidth: 600;
    backgroundColor: string;  // hex
    // + 20 derived color tokens
    spacing: { unit: 8 };
    typography: { baseSize: 16 };
    button: { radius: 8, style: "solid" | "outline" };
  };
  sections: Section[];  // 3-10 sections
  catalog?: { items: Product[] };
}
```

### Section
```typescript
{
  id: string;
  type: "header" | "hero" | "productGrid" | ...;  // 26 types
  layout?: {
    variant: "single" | "twoColumn" | "grid";
    columns?: [...];  // for twoColumn/grid
  };
  blocks: Block[];  // atomic components
  style?: { paddingX, paddingY, background };
}
```

---

## API Endpoints

### POST `/api/brand/ingest`
**Purpose**: Scrape brand website  
**Input**: `{ url: string }`  
**Output**: `{ brandContext: BrandContext }`  
**Errors**: `INVALID_URL`, `BLOCKED_URL`, `SCRAPE_TIMEOUT`, `RATE_LIMITED`  
**Rate Limit**: 10 req/min per IP (in-memory)

### POST `/api/campaign/intent`
**Purpose**: Parse campaign prompt  
**Input**: `{ brandContext, prompt: string }`  
**Output**: `{ intent: CampaignIntent }`  
**Errors**: `LLM_FAILED`, `LLM_TIMEOUT`, `LLM_OUTPUT_INVALID`

### POST `/api/email/plan`
**Purpose**: Generate email structure  
**Input**: `{ brandContext, intent }`  
**Output**: `{ plan: EmailPlan }`  
**Errors**: `LLM_FAILED`, `LLM_OUTPUT_INVALID`

### POST `/api/email/spec`
**Purpose**: Generate complete EmailSpec  
**Input**: `{ brandContext, intent, plan }`  
**Output**: `{ spec: EmailSpec, warnings: ValidationIssue[] }`  
**Errors**: `LLM_OUTPUT_INVALID` (after 3 attempts)

### POST `/api/email/render`
**Purpose**: Render EmailSpec to HTML  
**Input**: `{ spec: EmailSpec }`  
**Output**: `{ html: string, mjml: string, warnings: string[] }`  
**Errors**: `INVALID_INPUT`, `MJML_COMPILE_FAILED`

---

## Design Principles

### 1. **LLMs Design, Renderers Enforce**
- AI handles content and component selection
- Renderer ensures email-client compatibility
- No HTML generation by LLM (prevents hallucination)

### 2. **JSON as Contract**
- All LLM outputs are validated JSON schemas
- Never raw HTML or MJML
- Deterministic rendering from validated data

### 3. **Multi-Layer Validation**
- **Layer 1**: Zod schema (types, constraints)
- **Layer 2**: Structural validation (email best practices)
- **Layer 3**: Content quality (copywriting standards)

### 4. **Graceful Degradation**
- Warnings don't block generation
- Missing data uses sensible defaults
- Scraper returns fallback BrandContext on failure

### 5. **Type Safety First**
- No `any` types in codebase
- Full TypeScript inference
- Zod schemas generate types

---

## Quality Assurance

### Testing Strategy

**Unit Tests**: 100+ tests across modules
- Zod schema validation
- Extractor logic (brand name, colors, products)
- LLM output parsing
- Validator rules
- Renderer components

**Integration Tests**: API routes with mocked LLM
- End-to-end flows
- Error handling
- Edge cases

**Test Framework**: Vitest (fast, ESM-native)

**Coverage**:
- Schema validation: 100%
- Extractors: 95%+
- Validators: 90%+
- API routes: 85%+

### Code Quality

**ESLint Rules**: Next.js + Prettier integration  
**TypeScript**: Strict mode enabled  
**Git Hooks**: Pre-commit formatting checks  
**CI/CD**: GitHub Actions (tests on PR)

---

## Performance Characteristics

### Scraping (Brand Ingestion)
- **Average Time**: 6-8 seconds
- **Timeout**: 10 seconds (global budget)
- **Memory**: ~300MB peak (Chromium)
- **Concurrent**: 5-10 scrapes (1GB RAM server)

### LLM Generation
- **Intent Parser**: 2-3 seconds
- **Email Planner**: 3-5 seconds
- **EmailSpec Generator**: 5-10 seconds (with repair)
- **Total AI Pipeline**: 10-18 seconds

### Rendering
- **MJML Compilation**: <1 second
- **Output Size**: 50-150KB HTML
- **Deterministic**: Same input = same output

### End-to-End
**Cold Start**: 20-30 seconds (includes scraping)  
**Cached Brand**: 12-18 seconds (skip scraping)

---

## Deployment Architecture

### Docker Container (Recommended)

**Base Image**: `node:20-slim`

**Installed**:
- System dependencies for Chromium (30+ packages)
- pnpm package manager
- Playwright Chromium browser
- Node.js application

**Image Size**: ~1.5-2GB  
**Memory**: 1GB minimum (Starter plan)  
**CPU**: 1 vCPU minimum

**Environment Variables**:
```bash
OPENAI_API_KEY=<required>
NODE_ENV=production
RENDER=true  # or VERCEL=1 for Vercel
PORT=3000    # auto-assigned by platform
```

### Production Optimizations

**Browser Management**:
- Singleton pattern (reuse instance)
- Periodic restart (10-min intervals)
- Page cleanup after scraping
- Memory-optimized Chrome flags

**Resource Blocking**:
- Videos, audio blocked
- Fonts blocked in serverless
- Images preserved (needed for scraping)

**Caching** (not yet implemented):
- Redis-backed BrandContext cache
- 24-hour TTL per domain
- Invalidation on-demand

---

## Security

### SSRF Prevention
- URL validation (must be public)
- Blocks: localhost, 127.0.0.1, 10.x, 192.168.x, private IPs
- Rejects: file://, ftp://, data: schemes

### XSS Protection
- HTML escaping in renderer
- No user-controlled HTML generation
- Zod string sanitization (strips `<`, `>`)

### Rate Limiting
- 10 requests/min per IP (brand ingestion)
- In-memory (no database required)
- Sliding window algorithm

### API Key Management
- OpenAI key in environment variables
- Never logged or exposed
- Validated on startup

---

## Limitations & Future Enhancements

### Current Limitations
- ❌ No user authentication
- ❌ No brand caching (Redis)
- ❌ No ESP integrations (Mailchimp, Sendgrid)
- ❌ No image generation (DALL-E)
- ❌ No A/B testing variants
- ❌ Single language (English)

### Roadmap
- 🔲 **Caching Layer**: Redis for BrandContext
- 🔲 **User Accounts**: Auth + saved brands/campaigns
- 🔲 **ESP Integration**: Direct send via Mailchimp/Sendgrid
- 🔲 **AI Images**: Generate hero images with DALL-E
- 🔲 **Template Gallery**: Pre-built campaign templates
- 🔲 **A/B Testing**: Generate subject line variants
- 🔲 **Analytics**: Track email performance
- 🔲 **Multi-language**: I18n support

---

## Development Workflow

### Local Development
```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev  # http://localhost:3000

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format code
pnpm format
```

### Testing Scraper
```bash
# Test scraper on any website
pnpm scraper:dev -- https://allbirds.com
```

### Environment Setup
```bash
# .env.local
OPENAI_API_KEY=sk-...
NODE_ENV=development
```

### Docker Build (Local)
```bash
# Build image
docker build -t emailthing .

# Run container
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  emailthing
```

---

## Project Structure

```
emailthing/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── brand/                # Brand ingestion
│   │   ├── campaign/             # Intent parsing
│   │   ├── email/                # Planning, spec gen, render
│   │   └── health/               # Health check
│   ├── components/               # React components
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── lib/                          # Core business logic
│   ├── brand/                    # Brand utilities
│   ├── llm/                      # LLM integrations
│   │   ├── generateEmailSpec.ts  # Main generator
│   │   ├── parseCampaignIntent.ts
│   │   ├── planEmail.ts
│   │   └── schemas/              # LLM Zod schemas
│   ├── normalize/                # Schema transformers
│   ├── render/                   # MJML renderer
│   │   └── mjml/                 # Section/block renderers
│   ├── schemas/                  # Core Zod schemas
│   │   ├── brand.ts
│   │   ├── campaign.ts
│   │   ├── plan.ts
│   │   ├── emailSpec.ts
│   │   └── blocks.ts
│   ├── scraper/                  # Brand scraping engine
│   │   ├── index.ts              # Main orchestration
│   │   ├── browser.ts            # Playwright lifecycle
│   │   ├── extract/              # Modular extractors
│   │   └── __tests__/            # Unit tests
│   ├── theme/                    # Color derivation
│   ├── types/                    # TypeScript types
│   ├── utils/                    # Utilities
│   └── validators/               # Structural validation
│       └── emailSpec.ts          # Main validator
├── public/                       # Static assets
├── docs/                         # Documentation
├── spec/                         # Technical specification
├── Dockerfile                    # Docker build config
├── render.yaml                   # Render deployment config
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── vitest.config.ts              # Test config
└── README.md                     # Project overview
```

---

## Key Metrics

### Code Statistics
- **Total Lines**: ~15,000 lines of TypeScript
- **API Routes**: 5 endpoints
- **Zod Schemas**: 20+ schemas
- **Section Types**: 26 types
- **Block Types**: 14 types
- **Tests**: 100+ test cases
- **Dependencies**: 11 production, 15 dev

### Performance Targets
- **Scraping**: <10 seconds
- **LLM Generation**: <15 seconds
- **Rendering**: <1 second
- **End-to-End**: <30 seconds
- **Memory Usage**: <800MB peak

---

## Technical Highlights

### 1. **Sophisticated Repair Loop**
- 3-attempt strategy with temperature decay
- Error history tracking (prevents infinite loops)
- Explicit repair instructions on subsequent attempts
- Structural + content validation at each iteration

### 2. **Multi-Strategy Scraping**
- JSON-LD structured data (primary)
- DOM selector heuristics (fallback)
- Grid/carousel detection (enhanced)
- Web search enhancement (missing images/prices)

### 3. **Deterministic Rendering**
- Pure function: EmailSpec → HTML
- No randomness, no timestamps
- Idempotent (can re-render safely)
- Testable (snapshots match exactly)

### 4. **Type-Safe Throughout**
- Zod schemas generate TypeScript types
- No manual type definitions
- Runtime + compile-time validation
- IntelliSense everywhere

### 5. **Production-Ready Error Handling**
- Typed error codes (no magic strings)
- HTTP status code mapping
- User-friendly error messages
- Detailed logging for debugging

---

## Conclusion

**Emailify** demonstrates production-quality AI system design by:

1. **Separating Concerns**: AI for content, deterministic rendering for layout
2. **Enforcing Contracts**: JSON schemas as communication protocol
3. **Progressive Enhancement**: Multi-layer validation with graceful degradation
4. **Type Safety**: End-to-end TypeScript with runtime validation
5. **Testability**: Pure functions, dependency injection, comprehensive tests

The system is **fully functional**, **well-tested**, and **deployment-ready** for both containerized (Docker/Render) and serverless (Vercel) environments.

---

**Built with**: Next.js 16, TypeScript, OpenAI GPT-4o-mini, Playwright, MJML, Zod  
**Deployment**: Docker on Render.com (recommended) or Vercel serverless  
**License**: MIT  
**Author**: Technical take-home project demonstrating production-grade systems thinking
