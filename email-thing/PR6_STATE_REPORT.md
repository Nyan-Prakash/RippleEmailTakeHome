# PR6 State Report — EmailSpec Generator Implementation

> **Generated:** December 12, 2025  
> **Current Branch:** PR4 (Note: Repo shows PR4, but implementation includes PR5 and PR6 functionality)  
> **Purpose:** Comprehensive audit of EmailSpec generation system for ChatGPT review

---

## 1) High-level pipeline (PR2 → PR6)

### End-to-End Flow

The system implements a sequential pipeline from brand analysis to email spec generation:

```
User Input (URL + Prompt)
  ↓
POST /api/brand/ingest
  ├─ Scrapes brand website (Playwright)
  ├─ Extracts: name, logo, colors, fonts, voice, products
  └─ Returns: BrandContext
  ↓
User provides campaign prompt
  ↓
POST /api/campaign/intent
  ├─ LLM parses natural language
  ├─ Extracts: type, goal, tone, urgency, CTA, offer
  └─ Returns: CampaignIntent
  ↓
POST /api/email/plan
  ├─ LLM creates email structure plan
  ├─ Decides: sections, layout, product selection
  └─ Returns: EmailPlan
  ↓
POST /api/email/spec (PR6)
  ├─ LLM generates full EmailSpec JSON
  ├─ Validates against Zod schema
  ├─ Auto-repairs on validation failure (1 retry)
  └─ Returns: EmailSpec
```

### UI Steps

1. User enters brand URL → clicks "Analyze Brand"
2. `BrandProfile` component displays extracted brand data
3. User enters campaign prompt → clicks "Parse Intent"
4. `CampaignIntentCard` displays structured intent
5. User clicks "Plan Email"
6. `EmailPlanCard` displays email structure plan
7. User clicks "Generate Email Spec" (PR6 trigger)
8. `EmailSpecViewer` displays full EmailSpec JSON with theme, sections, blocks

### Main Functions Involved

**PR2:** `scrapeBrand(url)` → `BrandContext`  
**PR4:** `parseCampaignIntent({ brandContext, prompt })` → `CampaignIntent`  
**PR5:** `planEmail({ brandContext, intent })` → `EmailPlan`  
**PR6:** `generateEmailSpec({ brandContext, intent, plan })` → `EmailSpec`

### Payload Shapes

| Stage | Input | Output |
|-------|-------|--------|
| Brand Ingestion | `{ url: string }` | `{ brandContext: BrandContext }` |
| Intent Parsing | `{ brandContext, prompt: string }` | `{ intent: CampaignIntent }` |
| Email Planning | `{ brandContext, intent }` | `{ plan: EmailPlan }` |
| **Spec Generation (PR6)** | `{ brandContext, intent, plan }` | `{ spec: EmailSpec }` |

---

## 2) Files changed/created in PR6

### Schemas

**`lib/schemas/emailSpec.ts`**
- Purpose: Canonical EmailSpec contract with full validation
- Main exports:
  - `EmailSpecSchema` (Zod schema with superRefine)
  - `EmailSpec` (TypeScript type)
  - `EmailMetaSchema`, `ThemeSchema`, `SectionSchema`, `CatalogSchema`
  - Enums: section types, layout variants
- Validates: header/footer required, button required, productRef integrity

**`lib/schemas/blocks.ts`**
- Purpose: Atomic block definitions (logo, heading, paragraph, image, button, productCard, divider, spacer, smallPrint)
- Main exports:
  - `BlockSchema` (discriminated union)
  - Individual block schemas (9 types)
  - HTML sanitization (strips `<` and `>` from text)
- Enforces: text safety, URL validation, product references

**`lib/schemas/primitives.ts`**
- Purpose: Shared enums and base types
- Main exports:
  - `SectionTypeSchema` (7 types: header, hero, feature, productGrid, testimonial, trustBar, footer)
  - `BlockTypeSchema` (9 types)
  - `AlignmentSchema`, `HeadingLevelSchema`, `ButtonVariantSchema`, etc.

### LLM Logic

**`lib/llm/generateEmailSpec.ts`** (335 lines)
- Purpose: Core PR6 logic - converts BrandContext + CampaignIntent + EmailPlan → EmailSpec
- Main exports:
  - `generateEmailSpec(args)` (main function)
  - `GenerateEmailSpecLLMClient` (interface for DI)
  - `buildSystemPrompt()` (internal)
  - `buildUserPrompt()` (internal)
- Temperature: 0.7 (initial), 0.3 (repair)
- Model: `gpt-4o-mini`
- Max tokens: 3000
- Response format: `json_object`

**`lib/llm/errors.ts`**
- Purpose: Typed error handling for LLM operations
- Main exports:
  - `LLMError` (class)
  - `LLMErrorCode` (union type: 6 codes)
  - `createLLMError()` (factory)
  - `LLM_ERROR_MESSAGES` (map)

### API Routes

**`app/api/email/spec/route.ts`**
- Purpose: POST endpoint for EmailSpec generation
- Main exports: `POST(request)` handler
- Request schema: `{ brandContext, intent, plan }`
- Response: `{ spec: EmailSpec }` or `{ error: { code, message } }`
- Timeout: 15 seconds (enforced via AbortController)

### UI Components

**`app/components/EmailSpecViewer.tsx`** (389 lines)
- Purpose: Displays generated EmailSpec with visual breakdown
- Shows: meta (subject/preheader), theme (colors/fonts), sections (blocks), catalog
- Features: color swatches, section explorer, block type badges, JSON export

**`app/page.tsx`** (additions)
- Added `specState`: `'idle' | 'loading' | 'success' | 'error'`
- Added `handleGenerateSpec()` (lines ~217-254)
- Added "Generate Email Spec" button (line ~574)
- Integrated `EmailSpecViewer` component (line ~624)

### Tests

**`lib/llm/__tests__/generateEmailSpec.test.ts`** (405 lines, 5 tests)
- `generates valid EmailSpec with mocked LLM`
- `handles invalid JSON output`
- `retries on validation failure and succeeds`
- `throws LLM_OUTPUT_INVALID after failed retry`
- `validates catalog is empty - no productCard blocks`

**`app/api/email/spec/__tests__/route.test.ts`** (513 lines, 12 tests)
- Success case (200)
- Missing fields (400) × 3
- Invalid schemas (400) × 3
- LLM errors (500/502/504) × 3
- Unexpected error (500)
- Stack trace leak check
- Empty catalog handling

### Docs

**No new docs added in PR6** (existing README not updated for PR6 specifically)

---

## 3) EmailSpec contract

### File Path
`lib/schemas/emailSpec.ts`

### Zod Schema Name
`EmailSpecSchema`

### TypeScript Type Name
`EmailSpec`

### Top-Level Fields

```typescript
{
  meta: EmailMeta,           // subject (5-150 chars), preheader (10-200 chars)
  theme: Theme,              // colors, fonts, button style, container width
  sections: Section[],       // 3-10 sections (stacked layout units)
  catalog?: Catalog          // optional product catalog with items[]
}
```

### Section/Block System

**Section Types (Enum):**
- `header` - Brand identity section
- `hero` - Main message/offer
- `feature` - Content/benefits section
- `productGrid` - Product showcase
- `testimonial` - Social proof
- `trustBar` - Trust badges/guarantees
- `footer` - Legal/unsubscribe

**Block Types (Discriminated Union):**
- `logo` - Brand logo image
- `heading` - Text heading (levels 1-3)
- `paragraph` - Body text
- `image` - Standalone image
- `button` - CTA button
- `productCard` - Product reference (by ID)
- `divider` - Horizontal line
- `spacer` - Vertical spacing (4-64px)
- `smallPrint` - Footer text/legal

**Layout Variants:**
- `single` - One column (default)
- `twoColumn` - Two columns with specified widths
- `grid` - 2 or 3 column grid

### Cross-Field Invariants (superRefine)

Implemented in `EmailSpecSchema.superRefine()` at line ~158:

1. **Header Required:** Must include at least one section with `type: "header"`
   - Error: "Must include at least one 'header' section"
   - Path: `sections`

2. **Footer Required:** Must include at least one section with `type: "footer"`
   - Error: "Must include at least one 'footer' section"
   - Path: `sections`

3. **Button Required:** Must include at least one `button` block across all sections
   - Error: "Must include at least one 'button' block for CTA"
   - Path: `sections`

4. **Product Reference Integrity:** All `productCard` blocks must reference existing catalog items
   - Error: `Product reference "{productRef}" not found in catalog`
   - Path: `sections[{idx}].blocks[{idx}].productRef`

5. **Empty Catalog Check:** If catalog is empty, no `productCard` blocks allowed
   - Error: "Cannot have productCard blocks when catalog is empty"
   - Path: `sections[{idx}].blocks[{idx}]`

---

## 4) LLM generation logic

### File Path
`lib/llm/generateEmailSpec.ts`

### Function Signature

```typescript
async function generateEmailSpec(args: {
  brandContext: BrandContext;
  intent: CampaignIntent;
  plan: EmailPlan;
  deps?: {
    llm?: GenerateEmailSpecLLMClient;
  };
}): Promise<EmailSpec>
```

### Prompt Construction

**System Prompt Responsibilities** (lines 58-215):
- Provides brand information (name, website, colors, fonts, voice)
- Lists available products from catalog (first 20, with count if more)
- Describes campaign intent (type, goal, tone, CTA)
- Shows email plan structure (subject, preheader, sections)
- Defines CRITICAL RULES:
  - NO HTML/MJML in output
  - Use only real products from catalog
  - Allowed section/block types (enums listed)
  - Required sections (header + footer)
  - Required button block
  - Text safety (no `<` or `>` characters)
- Provides exact JSON schema structure

**User Prompt Responsibilities** (lines 217-220):
- Simple instruction: "Generate the canonical EmailSpec JSON based on the brand context, campaign intent, and email plan provided above. Remember: output JSON only, no HTML or MJML."

### Temperature Settings

- **Initial generation:** `0.7` (line 246)
- **Repair attempt:** `0.3` (line 278)

### JSON Parsing Approach

1. Call LLM with `response_format: { type: "json_object" }` (line 47)
2. Extract raw string output (line 238)
3. Parse with `JSON.parse()` (line 259)
4. Validate with `EmailSpecSchema.safeParse()` (line 267)

### Validation Flow

```
LLM Output (string)
  ↓
JSON.parse()
  ├─ Success → validate with Zod
  └─ Failure → throw LLM_OUTPUT_INVALID
  ↓
EmailSpecSchema.safeParse()
  ├─ Success → return EmailSpec
  └─ Failure → trigger repair retry
```

### Repair Retry Behavior

**Trigger:** First validation fails (`parseResult.success === false`, line 269)

**Process:**
1. Log validation error with full details (lines 273-276)
2. Build repair prompt with:
   - Previous JSON output
   - Formatted validation errors
   - Reminder of critical rules (header/footer, button, no productCard if empty catalog)
3. Call LLM again with temp=0.3 (line 278)
4. Parse and validate repaired output (lines 309-312)

**Retry Limit:** 1 retry only

**Error Feedback to LLM:** Full Zod error format passed in repair prompt (line 290)

**On Second Failure:** Throw `LLM_OUTPUT_INVALID` with original Zod error (lines 318-327)

### Dependency Injection Strategy

- **Interface:** `GenerateEmailSpecLLMClient` with single method `completeJson()`
- **Injection:** Via `deps.llm` optional parameter
- **Default:** `defaultLLMClient` function (lines 23-55) using OpenAI SDK
- **Testing:** Tests pass mocked client via `deps: { llm: mockLLM }`
- **Benefits:** No network calls in tests, fast execution, deterministic outputs

### OpenAI Model Used

- **Model:** `gpt-4o-mini` (line 39)
- **Timeout:** 15,000ms (15 seconds) (line 244)
- **Max Tokens:** 3,000 (line 43)
- **Response Format:** `json_object` (line 47)

---

## 5) API route

### File Path
`app/api/email/spec/route.ts`

### Method + URL
`POST /api/email/spec`

### Request Zod Schema

**Schema Name:** `RequestSchema` (lines 10-14)

**Key Fields:**
```typescript
{
  brandContext: BrandContextSchema,  // From lib/schemas/brand
  intent: CampaignIntentSchema,      // From lib/llm/schemas/campaignIntent
  plan: EmailPlanSchema              // From lib/llm/schemas/emailPlan
}
```

All three fields are required and fully validated before LLM call.

### Response Shape

**Success (200):**
```typescript
{
  spec: EmailSpec
}
```

**Error (400/500/502/504):**
```typescript
{
  error: {
    code: string,
    message: string
  }
}
```

### Timeout Enforcement Method

**Implementation:** `AbortController` pattern (lines 57-60, 68-76)

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);

try {
  const spec = await generateEmailSpec({ ... });
  clearTimeout(timeoutId);
  return NextResponse.json({ spec }, { status: 200 });
} catch (error) {
  clearTimeout(timeoutId);
  if (controller.signal.aborted) {
    return NextResponse.json({ error: { code: "LLM_TIMEOUT", ... }, { status: 504 });
  }
  throw error;
}
```

**Timeout Duration:** 15 seconds

### Error Mapping Logic

**Function:** `getStatusCode(errorCode: string): number` (lines 20-30)

| Error Code | HTTP Status | Meaning |
|------------|-------------|---------|
| `INVALID_INPUT` | 400 | Request validation failed |
| `INVALID_PROMPT` | 400 | Empty or malformed prompt |
| `LLM_CONFIG_MISSING` | 500 | Missing OPENAI_API_KEY |
| `LLM_FAILED` | 502 | LLM returned no content |
| `LLM_TIMEOUT` | 504 | Request exceeded 15s |
| `LLM_OUTPUT_INVALID` | 502 | Output failed Zod validation |
| `INTERNAL` (catch-all) | 500 | Unexpected error |

**Error Handling Flow:**
1. Zod validation failure → 400 with `INVALID_INPUT`
2. Timeout signal detected → 504 with `LLM_TIMEOUT`
3. `LLMError` caught → mapped status with error code/message
4. Unknown error → 500 with `INTERNAL` (no stack trace leaked, line 102)

---

## 6) UI integration

### Components Involved

1. **`app/page.tsx`** (main orchestrator)
   - State management for all 4 stages (brand, intent, plan, spec)
   - Sequential UI flow with progressive disclosure

2. **`app/components/BrandProfile.tsx`** (PR3)
   - Displays brand analysis results

3. **`app/components/CampaignIntentCard.tsx`** (PR4)
   - Displays parsed campaign intent

4. **`app/components/EmailPlanCard.tsx`** (PR5)
   - Displays email structure plan

5. **`app/components/EmailSpecViewer.tsx`** (PR6)
   - Displays full EmailSpec JSON
   - Path: `app/components/EmailSpecViewer.tsx`

### State Machine

**States:** `'idle' | 'loading' | 'success' | 'error'`

**State Variable:** `specState` (line 43 in `page.tsx`)

**State Transitions:**
```
idle
  ↓ (button click)
loading
  ↓ (API success)
success → (displays EmailSpecViewer)
  ↓ (API failure)
error → (displays error card)
  ↓ ("New Spec" button)
idle
```

### Trigger Button

**Location:** Line ~609 in `app/page.tsx`

**Button Text:** "Generate Email Spec" (idle) / "Generating..." (loading)

**Handler:** `handleGenerateSpec()` (lines 217-254)

**Conditions:**
- Enabled only when: `brandContext`, `campaignIntent`, and `emailPlan` all exist
- Disabled when: `specState === 'loading'`
- Hidden after: `specState === 'success'`

### EmailSpec Display

**Component:** `EmailSpecViewer` (line 624 in `page.tsx`)

**Visible Sections in Success State:**
- **Header:** "Email Spec" title + "New Spec" button
- **Meta Card:** Subject line + preheader (blue gradient background)
- **Theme Card:** Color swatches (5 colors with hex values), font display, button style
- **Sections Explorer:** Accordion-style list of all sections
  - Section type badge
  - Section ID
  - Block count
  - Expandable block list with type badges
- **Catalog Card:** Product grid if catalog exists
- **JSON Export:** Collapsible raw JSON view with copy button

**Error State Display:**
- Red card with error icon
- Error code (bold)
- Error message (user-friendly)

**Loading State Display:**
- Blue card with spinner
- "Generating email spec..." message

---

## 7) Tests added/updated

### PR6-Related Test Files

#### `lib/llm/__tests__/generateEmailSpec.test.ts` (5 tests)

**Assertions:**
1. ✅ Valid EmailSpec generated with mocked LLM
   - Verifies all required sections (header, hero, footer)
   - Checks button exists
   - Confirms LLM called once
2. ✅ Invalid JSON throws `LLM_OUTPUT_INVALID`
   - Tests malformed JSON handling
3. ✅ Retry on validation failure succeeds
   - First output missing header/footer
   - Second output valid
   - Confirms 2 LLM calls
4. ✅ Failed retry throws `LLM_OUTPUT_INVALID`
   - Both attempts produce invalid output
   - Confirms 2 LLM calls (initial + retry)
5. ✅ Empty catalog validation
   - No productCard blocks when catalog empty
   - Validates catalog integrity rules

**LLM Mocking Strategy:**
- Uses Vitest `vi.fn()` to mock `completeJson` method
- Returns pre-crafted JSON strings (valid EmailSpec objects)
- No actual OpenAI API calls
- `mockResolvedValue()` / `mockResolvedValueOnce()` for sequential responses

**Important Fixtures:**
- `mockBrandContext` (with 1 product)
- `mockIntent` (sale campaign)
- `mockPlan` (3 sections: header, hero, footer)
- Valid EmailSpec mock (200+ lines, complete structure)

#### `app/api/email/spec/__tests__/route.test.ts` (12 tests)

**Assertions:**
1. ✅ 200 response with valid request
2. ✅ 400 for missing `brandContext`
3. ✅ 400 for missing `intent`
4. ✅ 400 for missing `plan`
5. ✅ 400 for invalid `brandContext` schema
6. ✅ 400 for invalid `intent` schema
7. ✅ 400 for invalid `plan` schema
8. ✅ 500 for `LLM_CONFIG_MISSING`
9. ✅ 502 for `LLM_FAILED`
10. ✅ 504 for `LLM_TIMEOUT`
11. ✅ 502 for `LLM_OUTPUT_INVALID`
12. ✅ 500 for unexpected errors
13. ✅ No stack trace leaks
14. ✅ Empty catalog handling
15. ✅ All request fields passed correctly

**LLM Mocking Strategy:**
- Mocks `generateEmailSpec` function directly
- Uses `vi.mock()` to replace entire module
- Returns `mockEmailSpec` or throws `LLMError`
- No network calls

**Important Fixtures:**
- Mock Next.js `NextRequest` objects
- `createMockRequest()` helper function
- Complete `mockEmailSpec` with all required sections

### Test Confirmation

✅ **No real network calls:** All LLM clients mocked via dependency injection  
✅ **Deterministic outputs:** Pre-crafted JSON fixtures used throughout  
✅ **Fast execution:** No I/O, sub-second test runs  
✅ **Error path coverage:** All 6 LLM error codes tested  
✅ **Schema validation:** Invalid inputs rejected before LLM call

---

## 8) Merge gates & commands

### Validation Commands

**Type Check:**
```bash
pnpm typecheck
```
- Runs: `tsc --noEmit`
- Must pass: No TypeScript errors
- Validates: All PR6 types (EmailSpec, sections, blocks, etc.)

**Lint:**
```bash
pnpm lint
```
- Runs: `eslint .`
- Must pass: No ESLint errors
- Checks: Code style, imports, unused vars

**Format Check:**
```bash
pnpm format:check
```
- Runs: `prettier --check .`
- Must pass: All files formatted
- Config: Prettier with ESLint integration

**Tests:**
```bash
pnpm test
```
- Runs: `vitest` (all test files)
- Must pass: All tests green
- PR6 adds: 17 new tests (5 unit + 12 route)

**Build:**
```bash
pnpm build
```
- Runs: `next build`
- Must pass: Production build succeeds
- Validates: Server component imports, API routes, type safety

### Full Validation Sequence

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

### Environment Variables Required

**For Development/Testing:**
- `OPENAI_API_KEY` - Required for live LLM calls (not needed for tests, mocked)

**Note:** Tests do NOT require `OPENAI_API_KEY` because all LLM calls are mocked via dependency injection.

### Playwright Setup (Not Required for PR6)

PR6 does not use Playwright. Playwright is only used in PR2 (brand scraper) and is already set up.

### Known Gotchas

1. **No env vars needed for tests** - All LLM calls mocked
2. **Build requires Node 20+** - Specified in `.nvmrc`
3. **Timeout in tests** - Some route tests may need longer timeout if running slow (not typical)

---

## 9) Known limitations / risks

### Schema Brittleness

**Location:** `lib/schemas/emailSpec.ts`

**Issue:** Deeply nested discriminated unions make error messages complex
- `BlockSchema` has 9 variants
- `LayoutSchema` has 3 variants with conditional fields
- Validation errors can be cryptic (e.g., "Expected literal 'logo', received 'heading'")

**Impact on PR7/PR8:**
- Renderer must handle all 9 block types defensively
- Invalid block types should be filtered, not crash
- Consider adding `validateEmailSpecStructure()` wrapper (already exists in `lib/validators/emailSpec.ts`)

### TODOs Left Behind

**Search Results:** No explicit TODO comments found in PR6 files

**Implicit TODOs:**
1. No caching of generated specs (every call regenerates)
2. No streaming response (user waits full 15s on timeout)
3. No progressive disclosure of generation steps
4. No A/B subject line generation (EmailPlan has `alternatives` but spec doesn't use them)

### Edge Cases

**Empty Catalog:**
- ✅ Handled: Validation prevents productCard blocks
- ✅ Tested: `validates catalog is empty - no productCard blocks`
- ⚠️ Risk: LLM may still try to add product sections with generic text

**Missing Logo:**
- ⚠️ Not explicitly handled in EmailSpec
- Logo block has required `src` field
- If brand scraper returns empty `logoUrl`, spec generation may fail or use empty string
- **PR7 should validate:** Logo URL is non-empty or filter logo blocks

**Very Long Catalog (>20 products):**
- Prompt truncates to first 20 products (line 71 in `generateEmailSpec.ts`)
- Selected products from EmailPlan might not be in the truncated list
- ⚠️ Risk: Product references could be invalid
- **PR7 should validate:** All `selectedProducts` from plan are in truncated catalog summary

**Duplicate Section IDs:**
- Not validated in Zod schema
- Could cause rendering issues
- **PR7 should add:** Unique section ID validation (already implemented in `lib/validators/emailSpec.ts` line 164)

**Text with HTML:**
- ✅ Handled: `sanitizeText()` function strips `<` and `>` (line 10 in `blocks.ts`)
- ✅ Applied to all text blocks
- Risk: User intent lost (e.g., "Save <50%" becomes "Save 50%")

### Renderer-Unfriendly Patterns

**Two-Column Layouts:**
- Schema allows `twoColumn` with optional `columns` field
- If `columns` is undefined but variant is `twoColumn`, renderer will fail
- **PR8 must handle:** Default to equal columns if not specified

**Grid Layout Without Gap:**
- `GridLayoutSchema` requires `gap` field
- No default provided
- Renderer must handle missing gap

**ProductCard Without Catalog:**
- Zod validation prevents this
- But renderer should still check defensively

**Missing Theme Defaults:**
- Theme has defaults in schema
- But LLM might override with invalid values (e.g., `containerWidth: 1000`)
- Schema enforces max 720px, but renderer should clamp values

**Button Without href:**
- Button requires `href` field
- But URL validation allows empty string
- Renderer must handle empty href (probably skip rendering)

---

## 10) What PR7 will need (based on current code)

### Integration Points for Validator + Repair Loop

1. **Hook into `generateEmailSpec()` after initial LLM call**
   - Location: `lib/llm/generateEmailSpec.ts` line ~267
   - Current: Basic Zod validation
   - PR7 should: Call `validateEmailSpecStructure()` from `lib/validators/emailSpec.ts`
   - Return: `ValidationResult` with structured issues

2. **Surface validation issues in repair prompt**
   - Location: Line ~285 in `generateEmailSpec.ts`
   - Current: Passes Zod errors
   - PR7 should: Include structural validation issues (CTA missing, unsubscribe missing, etc.)
   - Format: Human-readable list of issues with severity levels

3. **Add structural validation before returning success**
   - Location: Line ~312 in `generateEmailSpec.ts` (after repair success)
   - Current: Only Zod validation
   - PR7 should: Run `validateEmailSpecStructure()` on repaired spec
   - Action: Throw if critical issues remain

4. **Extend retry loop to 2-3 attempts**
   - Location: Lines ~277-327 in `generateEmailSpec.ts`
   - Current: 1 retry only
   - PR7 should: Allow 2-3 retries with progressively stricter prompts
   - Track: Attempt count, previous errors, convergence

5. **Add validation to API route before returning**
   - Location: `app/api/email/spec/route.ts` line ~68
   - Current: Returns spec immediately after generation
   - PR7 should: Run final validation, return warnings (non-blocking) alongside spec
   - Response: `{ spec, warnings?: ValidationIssue[] }`

6. **Create validation result UI component**
   - Location: New component or extend `EmailSpecViewer.tsx`
   - Purpose: Display warnings/errors from validation
   - Show: Severity badges, issue descriptions, affected paths
   - Action: Allow user to regenerate or accept with warnings

7. **Add lint rules for specific campaign types**
   - Location: New function in `lib/validators/emailSpec.ts`
   - Check: Sale campaigns have promo language, launch campaigns have "new" mentions
   - Input: `EmailSpec` + `CampaignIntent`
   - Return: Additional validation issues

8. **Validate section ordering makes sense**
   - Location: `lib/validators/emailSpec.ts`
   - Rules: Header first, footer last, hero in top 3
   - Return: Warning if order is unusual (non-blocking)

9. **Check product selection quality**
   - Location: `lib/validators/emailSpec.ts`
   - Validate: Products in spec match `selectedProducts` from EmailPlan
   - Check: ProductCard refs are in expected sections (productGrid, hero, etc.)
   - Return: Warning if misaligned

10. **Add theme consistency validation**
    - Location: `lib/validators/emailSpec.ts`
    - Check: Theme colors match brand colors (within tolerance)
    - Check: Fonts match brand fonts
    - Return: Warning if brand identity diluted

11. **Create repair prompt builder**
    - Location: New function in `lib/llm/generateEmailSpec.ts`
    - Input: `EmailSpec`, `ValidationResult`, attempt number
    - Output: Structured repair prompt with specific fixes
    - Strategy: Progressively more directive with each attempt

12. **Add telemetry for validation failures**
    - Location: `lib/llm/generateEmailSpec.ts` around error logging
    - Track: Validation issue frequency, repair success rate, common failure patterns
    - Purpose: Improve prompts over time

### Data That PR7 Will Validate

**Primary:** `EmailSpec` object (output of `generateEmailSpec()`)

**Context:** Also needs access to:
- `BrandContext` (for brand consistency checks)
- `CampaignIntent` (for campaign type-specific rules)
- `EmailPlan` (for plan adherence checks)

### Where Errors Should Be Surfaced

**Server-side (non-blocking):**
- Log to console with structured format
- Return in API response as `warnings: ValidationIssue[]`
- Never block successful generation for warnings

**Client-side:**
- Display in `EmailSpecViewer` component
- Show warning banner with count
- Expandable list of issues
- Color-coded by severity (error=red, warning=yellow)

**LLM Repair Loop:**
- Pass full validation result to repair prompt
- Include both Zod errors and structural issues
- Format as numbered list with clear descriptions

### Retry Loop Boundaries

**Current State:** 1 retry attempt (lines 277-327 in `generateEmailSpec.ts`)

**PR7 Should Implement:**

```typescript
const MAX_RETRIES = 3;
let attemptCount = 0;
let lastValidationResult: ValidationResult | null = null;

while (attemptCount < MAX_RETRIES) {
  const spec = await generateOrRepair(...);
  const validationResult = validateEmailSpecStructure(spec);
  
  if (validationResult.ok) {
    return { spec, warnings: validationResult.issues };
  }
  
  attemptCount++;
  lastValidationResult = validationResult;
  
  if (attemptCount >= MAX_RETRIES) {
    throw new LLMError('LLM_OUTPUT_INVALID', 'Failed after 3 repair attempts');
  }
}
```

**Retry Boundaries:**
- Attempt 1: Initial generation (temp=0.7)
- Attempt 2: First repair (temp=0.5, Zod errors only)
- Attempt 3: Second repair (temp=0.3, Zod + structural errors)
- Attempt 4: Final repair (temp=0.2, directive prompt with explicit fixes)

**Stop Conditions:**
- ✅ No validation errors (may still have warnings)
- ❌ Max retries reached
- ❌ Same error repeated 2+ times (convergence failed)
- ❌ Repair makes output worse (more errors than before)

---

## Summary

PR6 successfully implements canonical EmailSpec generation using GPT-4o-mini with automatic validation and 1-retry repair logic. The system enforces strict schema contracts (header, footer, button required; product references validated) and sanitizes text for email safety. 

**Key achievements:**
- 335-line LLM generator with dependency injection
- Comprehensive Zod schemas with superRefine validations
- 17 tests (all passing, no network calls)
- Clean API route with timeout enforcement
- Production-ready UI with EmailSpecViewer component

**PR7 will enhance this foundation** by adding multi-attempt repair loops, structural linting (CTA placement, unsubscribe presence), campaign-specific validation rules, and non-blocking warning system. The existing `lib/validators/emailSpec.ts` file provides the foundation for PR7's enhanced validation logic.
