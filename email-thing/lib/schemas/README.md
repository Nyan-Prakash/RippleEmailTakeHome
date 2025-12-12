# Email Schema Layer

This directory contains the canonical type system for the AI Marketing Email Generator. All data contracts are defined here using **Zod schemas** for runtime validation and **TypeScript types** inferred from those schemas for compile-time safety.

## Purpose

The schema layer serves as the **single source of truth** for all data structures in the system. It ensures:

- **Type Safety**: TypeScript types are inferred from Zod schemas, eliminating drift between runtime and compile-time types
- **Runtime Validation**: All data can be validated at runtime using Zod's `.parse()` or `.safeParse()` methods
- **Defaults & Normalization**: Schemas apply sensible defaults and normalization rules
- **Contract-First Development**: Future PRs (scraping, LLM generation, rendering) consume these contracts

## Core Contracts

### 1. BrandContext

Represents a brand's visual identity, voice, and product catalog.

```typescript
import { BrandContextSchema, type BrandContext } from "@/lib/schemas";

const brandData = BrandContextSchema.parse(input);
```

**Key Fields:**

- `brand.name`: Brand name (default: "Unknown Brand")
- `brand.colors`: Hex colors (#RRGGBB format)
- `brand.fonts`: Heading and body fonts
- `brand.voiceHints`: Array of voice/tone samples (max 20)
- `catalog`: Array of products
- `trust`: Trust signals (shipping, returns, etc.)

### 2. CampaignIntent

Structured understanding of user's campaign request.

```typescript
import { CampaignIntentSchema, type CampaignIntent } from "@/lib/schemas";

const intent = CampaignIntentSchema.parse({
  type: "sale",
  tone: "urgent",
  offer: "25% off everything",
});
```

**Campaign Types:**

- `sale`, `launch`, `newsletter`, `backInStock`, `winback`, `abandonedCart`, `generic`

**Tones:**

- `playful`, `premium`, `minimal`, `urgent`, `friendly`, `bold`

### 3. EmailPlan

Email structure without copy (section planning).

```typescript
import { EmailPlanSchema, type EmailPlan } from "@/lib/schemas";

const plan = EmailPlanSchema.parse({
  campaignType: "sale",
  goal: "Drive immediate purchases with urgency",
  sections: [
    { type: "header" },
    { type: "hero" },
    { type: "productGrid", count: 4 },
    { type: "footer" },
  ],
});
```

**Requirements:**

- Must include at least `header`, `hero`, and `footer`
- ProductGrid `count` must be 2-8

### 4. EmailSpec

The complete email specification (most important contract).

```typescript
import { EmailSpecSchema, type EmailSpec } from "@/lib/schemas";

const emailSpec = EmailSpecSchema.parse(input);
```

**Structure:**

- `meta`: Subject (5-150 chars) and preheader (10-200 chars)
- `theme`: Design tokens (colors, fonts, button style, container width)
- `sections`: Array of sections (header, hero, productGrid, etc.)
- `catalog`: Optional product catalog

**Email Constraints (Encoded in Schema):**

- Container width: 600px default (480-720 range)
- Stacked sections (no absolute positioning)
- Layout variants: `single`, `twoColumn`, `grid`
- Section types: `header`, `hero`, `feature`, `productGrid`, `testimonial`, `trustBar`, `footer`

### 5. Blocks

Atomic components that go inside sections.

**Allowed Block Types:**

- `logo`: Logo image with optional link
- `heading`: Text heading (levels 1-3)
- `paragraph`: Body text
- `image`: Image with alt text and optional link
- `button`: CTA button (required href)
- `productCard`: Reference to product in catalog
- `divider`: Horizontal rule
- `spacer`: Vertical spacing (4-64px)
- `smallPrint`: Footer text (legal, unsubscribe)

**Validation Rules:**

- No HTML in text fields (auto-stripped)
- Button `href` must be valid URL
- Spacer `size` clamped to 4-64

## Normalization

Normalizers apply defaults and sanitize input:

```typescript
import { normalizeBrandContext, normalizeEmailSpec } from "@/lib/types";

const brandContext = normalizeBrandContext(scrapedData);
const emailSpec = normalizeEmailSpec(llmOutput);
```

**What Normalizers Do:**

- Fill in missing defaults
- Trim whitespace
- Clamp numeric values (padding, radius, container width)
- Generate unique section IDs
- Truncate arrays to max lengths
- Sanitize text (strip HTML tags)

## Structural Validation

Beyond schema validation, `validateEmailSpecStructure()` checks design requirements:

```typescript
import { validateEmailSpecStructure } from "@/lib/types";

const result = validateEmailSpecStructure(emailSpec);

if (!result.ok) {
  console.error("Validation failed:", result.issues);
}
```

**Checks:**

- ✅ At least one CTA button exists outside footer
- ✅ Footer section exists
- ✅ Footer contains `smallPrint` with `{{unsubscribe}}` token
- ✅ Product references exist in catalog
- ✅ Section IDs are unique

## Usage Examples

### Validating Brand Data

```typescript
import { BrandContextSchema } from "@/lib/schemas";

const result = BrandContextSchema.safeParse(scrapedData);

if (result.success) {
  const brandContext = result.data;
  // Use validated data
} else {
  console.error("Validation failed:", result.error);
}
```

### Creating an EmailSpec

```typescript
import { EmailSpecSchema, type EmailSpec } from "@/lib/schemas";

const emailSpec: EmailSpec = {
  meta: {
    subject: "Summer Sale - 50% Off",
    preheader: "Limited time offer on all items",
  },
  theme: {
    containerWidth: 600,
    backgroundColor: "#FFFFFF",
    primaryColor: "#FF6B35",
    // ... other theme properties (defaults applied)
  },
  sections: [
    {
      id: "header-1",
      type: "header",
      blocks: [
        {
          type: "logo",
          src: "https://example.com/logo.png",
          href: "https://example.com",
        },
      ],
    },
    // ... more sections
  ],
};

// Validate
const validated = EmailSpecSchema.parse(emailSpec);
```

### Using in Future PRs

**PR2 (Scraping):**

```typescript
const brandContext = BrandContextSchema.parse({
  brand: {
    /* scraped data */
  },
  catalog: [
    /* scraped products */
  ],
});
```

**PR4-6 (LLM Generation):**

```typescript
const llmOutput = await generateEmailSpec(brandContext, intent);
const validated = EmailSpecSchema.parse(llmOutput);
```

**PR8 (Rendering):**

```typescript
function renderToMJML(emailSpec: EmailSpec): string {
  // Type-safe rendering
  emailSpec.sections.forEach((section) => {
    // ...
  });
}
```

## Fixtures

Example data for testing and development:

- `spec/examples/brandContext.example.json`
- `spec/examples/campaignIntent.example.json`
- `spec/examples/emailPlan.example.json`
- `spec/examples/emailSpec.sale.example.json`
- `spec/examples/emailSpec.launch.example.json`

All fixtures validate against their schemas and can be used as reference implementations.

## Testing

Run schema validation tests:

```bash
pnpm test lib/schemas
pnpm test lib/normalize
pnpm test lib/validators
```

## Design Philosophy

1. **JSON-First**: LLMs output validated JSON, never HTML
2. **Constraints Encoded**: Email limitations (600px width, table-safe layouts) are enforced by schemas
3. **Fail Fast**: Invalid data is caught at schema boundaries, not during rendering
4. **Single Source of Truth**: Types are inferred from schemas, never hand-written

## Next PRs

- **PR2**: Use `BrandContext` as output contract for scraping
- **PR3**: Cache `BrandContext` by URL
- **PR4-6**: Generate `CampaignIntent`, `EmailPlan`, and `EmailSpec` via LLM
- **PR7**: Use `validateEmailSpecStructure()` for repair loops
- **PR8**: Consume `EmailSpec` for MJML rendering
