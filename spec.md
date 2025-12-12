# AI Marketing Email Generator — Extremely Detailed Technical Specification

> **Goal:** Build a production-quality AI system that generates *sendable, brand-accurate marketing emails* using a structured JSON → renderer architecture. This spec intentionally goes far beyond MVP-level detail to demonstrate systems thinking, robustness, and real-world email constraints.

---

## TABLE OF CONTENTS

1. Philosophy & Design Principles
2. System Overview
3. End-to-End Data Flow
4. Input Contracts
5. Web Scraping & Brand Ingestion (Deep Dive)
6. BrandContext Construction
7. Campaign Prompt Understanding
8. Email Planning Layer
9. EmailSpec Schema (Canonical Contract)
10. Section System (Deep Dive)
11. Block System (Deep Dive)
12. Layout & Responsiveness Model
13. Theming & Design Tokens
14. Validation, Linting, and Repair Loops
15. Rendering Pipeline (JSON → MJML → HTML)
16. Preview Rendering (Browser)
17. Performance, Caching, and Failure Modes
18. Security & Abuse Considerations
19. Deployment & Hosting
20. Testing Strategy
21. Non-Goals & Explicit Tradeoffs
22. Future Extensions

---

## 1. Philosophy & Design Principles

### 1.1 Core Philosophy

This system is built on the following belief:

> **LLMs should design *what* to say and *which components* to use — not *how pixels are placed*.**

Email HTML is notoriously fragile. Absolute positioning, arbitrary divs, and free-form CSS break across clients. Therefore:

* The LLM never outputs HTML
* The LLM never controls pixel-level layout
* The LLM outputs a constrained, validated JSON spec
* The renderer enforces all email-safe layout rules

### 1.2 Why JSON-first?

* Deterministic rendering
* Safer iteration
* Easier debugging
* Brand consistency
* Enables future ESP exports

### 1.3 Design Constraints (Non-Negotiable)

* Max width: **600px**
* Stacked sections
* Table-safe layouts
* Inline styles only
* No JS, no forms, no external CSS

---

## 2. System Overview

High-level system architecture:

```
[User]
  ↓
[Next.js UI]
  ↓
/api/generate
  ↓
[Brand Scraper]
  ↓
[BrandContext]
  ↓
[Campaign Intent Parser]
  ↓
[Email Planner]
  ↓
[EmailSpec Generator]
  ↓
[Validator + Repair]
  ↓
[Renderer]
  ↓
[Preview + HTML Export]
```

Each stage has a **single responsibility** and a **typed contract**.

---

## 3. End-to-End Data Flow

1. User submits `brandUrl` + `prompt`
2. Backend fetches and parses brand website
3. BrandContext is constructed
4. Prompt is interpreted into campaign intent
5. Email plan (sections + goals) is generated
6. EmailSpec JSON is generated
7. JSON is validated and repaired if needed
8. Renderer converts JSON → MJML → HTML
9. UI displays preview + exports

---

## 4. Input Contracts

### 4.1 Public API Input

```json
{
  "brandUrl": "https://example.com",
  "prompt": "Make a premium launch email for our new winter jacket"
}
```

### 4.2 Internal Invariants

* `brandUrl` must be publicly reachable
* `prompt` must be non-empty natural language
* No authentication required

---

## 5. Web Scraping & Brand Ingestion (Deep Dive)

### 5.1 Why Scraping is Hard

Modern ecommerce sites:

* Are JS-rendered (React, Vue)
* Lazy-load images
* Obfuscate CSS
* Use custom fonts

Therefore:

* **Playwright is required**, not just fetch + Cheerio

### 5.2 Page Selection Strategy

The scraper MUST limit scope to avoid cost/time explosion.

Pages fetched:

1. Homepage
2. One collection/category page (if detected)
3. Up to 4 product pages

Detection heuristics:

* URLs containing `/products/`, `/collections/`, `/shop`
* Structured data (`application/ld+json`)

### 5.3 Data Extraction Steps

#### 5.3.1 Brand Name

* `<title>` tag
* OpenGraph `og:site_name`
* Logo alt text fallback

#### 5.3.2 Logo Detection

Heuristics:

* `<img>` near top of DOM
* SVG with brand name in `aria-label`
* `rel="icon"` fallback

#### 5.3.3 Color Extraction

Sources:

* CSS variables (`--primary`, `--accent`)
* Computed styles of header buttons
* Dominant image color (optional)

Post-processing:

* Normalize to hex
* Filter near-white/near-black

#### 5.3.4 Font Detection

* `font-family` on `body` and headings
* Ignore system defaults
* Fallback to `Arial, sans-serif`

#### 5.3.5 Voice & Tone Signals

Extract:

* Hero headlines
* CTA button labels
* Taglines

Process:

* Deduplicate
* Truncate to 5–10 samples

#### 5.3.6 Product Extraction

From product pages:

* Title
* Price
* Image
* URL

Limit:

* Max 8 products

---

## 6. BrandContext Construction

### 6.1 Purpose

BrandContext is the **only brand input** allowed into the LLM.

### 6.2 Structure

```json
{
  "brand": {
    "name": "",
    "website": "",
    "logoUrl": "",
    "colors": {
      "primary": "",
      "background": "",
      "text": ""
    },
    "fonts": {
      "heading": "",
      "body": ""
    },
    "voiceHints": [],
    "snippets": {}
  },
  "catalog": [],
  "trust": {}
}
```

### 6.3 Normalization Rules

* Colors always hex
* Fonts sanitized
* Missing fields filled with defaults

---

## 7. Campaign Prompt Understanding

### 7.1 Purpose

Translate unstructured user intent into structured guidance.

### 7.2 Extracted Fields

* Campaign type (sale, launch, newsletter)
* Offer details
* Urgency
* Tone modifiers
* CTA preference

### 7.3 Example

```json
{
  "type": "launch",
  "tone": "premium",
  "ctaText": "Discover the Collection"
}
```

---

## 8. Email Planning Layer

### 8.1 Why Planning Exists

Prevents:

* Random section ordering
* Overly verbose emails
* Missing critical components

### 8.2 Planner Output

Planner outputs **structure only**, no copy.

```json
{
  "sections": [
    { "type": "header" },
    { "type": "hero" },
    { "type": "productGrid" },
    { "type": "trustBar" },
    { "type": "footer" }
  ]
}
```

---

## 9. EmailSpec Schema (Canonical Contract)

### 9.1 This is the Most Important Artifact

Everything downstream depends on this contract.

### 9.2 Top-Level Fields

* meta
* theme
* sections
* catalog (resolved references)

---

## 10. Section System (Deep Dive)

### 10.1 Sections are Stack Units

Each section maps to **one MJML section**.

### 10.2 Supported Section Types

* header
* hero
* feature
* productGrid
* testimonial
* trustBar
* footer

### 10.3 Section Layout Variants

* single
* twoColumn
* grid

---

## 11. Block System (Deep Dive)

### 11.1 Blocks are Atomic

Blocks never contain other blocks.

### 11.2 Supported Blocks

* logo
* heading
* paragraph
* image
* button
* productCard
* divider
* spacer
* smallPrint

### 11.3 Example Block

```json
{ "type": "button", "text": "Shop Now", "href": "...", "align": "center" }
```

---

## 12. Layout & Responsiveness Model

* Desktop: columns respected
* Mobile: stacked automatically
* Handled entirely by MJML

---

## 13. Theming & Design Tokens

Theme tokens control:

* Spacing
* Color
* Typography
* Button shape

LLM may suggest tokens but renderer enforces limits.

---

## 14. Validation, Linting, and Repair Loops

### 14.1 Validation

* Zod schema
* Required sections
* Required CTA

### 14.2 Repair Loop

If invalid:

* Send errors to LLM
* Request corrected JSON only

---

## 15. Rendering Pipeline (JSON → MJML → HTML)

### 15.1 Mapping

| JSON    | MJML       |
| ------- | ---------- |
| section | mj-section |
| column  | mj-column  |
| heading | mj-text    |
| button  | mj-button  |

### 15.2 Compilation

MJML → responsive HTML

---

## 16. Preview Rendering (Browser)

* Render HTML inside iframe
* Same HTML as export

---

## 17. Performance, Caching, and Failure Modes

* Cache BrandContext by URL
* Timeout scraping at 10s
* Fallback to generic brand

---

## 18. Security & Abuse Considerations

* Block private IP scraping
* Rate limit generation
* Sanitize URLs

---

## 19. Deployment & Hosting

* Vercel
* Edge-disabled routes for Playwright

---

## 20. Testing Strategy

* Schema tests
* Snapshot tests for HTML
* Manual visual review

---

## 21. Non-Goals & Explicit Tradeoffs

* No ESP send
* No auth
* No analytics

---

## 22. Future Extensions

* ESP exports
* Image generation
* Template gallery

---

**This spec intentionally demonstrates production-grade thinking rather than MVP shortcuts.**
