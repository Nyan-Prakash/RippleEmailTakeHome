# Layout Variant Validation Fix & Infinite Loop Resolution

## Problem 1: Layout Variant Validation Error
The error `sections.4.layout.variant: Invalid input` was occurring because the LLM was generating invalid `layout.variant` values in the EmailSpec JSON. The schema only accepts exactly three values: `"single"`, `"twoColumn"`, or `"grid"` (case-sensitive).

## Problem 2: Infinite Loop During Generation
After the initial fix, the generation process would run infinitely without completing, eventually hitting the 95-second timeout.

## Root Causes

### Root Cause 1: Unclear System Prompt
The system prompt in `generateEmailSpec.ts` was not explicit enough about:
1. The exact allowed values for `layout.variant`
2. The case-sensitivity requirement
3. The complete structure of layout objects

The LLM could have been generating variations like:
- `"two-column"` instead of `"twoColumn"`
- `"two_column"`
- `"singleColumn"` instead of `"single"`
- Other invalid variant names

## Solution

### 1. Enhanced System Prompt Documentation
Updated `lib/llm/generateEmailSpec.ts` to provide explicit examples and constraints:

**Added detailed layout structure in schema definition:**
```typescript
"layout": {
  "variant": "single" | "twoColumn" | "grid",
  // For twoColumn: "columns": [{"width": "50%", "blocks": [...]}, {"width": "50%", "blocks": [...]}]
  // For grid: "columns": 2 | 3, "gap": number
}
```

**Enhanced LAYOUT RULES section:**
- Made variant values explicit and emphasized case-sensitivity
- Added clear examples for each layout type
- Clarified that `"single"`, `"twoColumn"`, and `"grid"` are the ONLY valid values

**Added concrete layout examples:**
```typescript
// Single column section (most common)
{ "id": "hero-01", "type": "hero", "blocks": [...] }

// Two-column section
{
  "id": "feature-01",
  "type": "feature",
  "layout": {
    "variant": "twoColumn",
    "columns": [
      {"width": "50%", "blocks": [...]},
      {"width": "50%", "blocks": [...]}
    ]
  },
  "blocks": []
}

// Grid section
{
  "id": "products-01",
  "type": "productGrid",
  "layout": {"variant": "grid", "columns": 3, "gap": 16},
  "blocks": [...]
}
```

### 2. Enhanced Repair Instructions
Added specific guidance in repair prompts:
```
- If errors mention "layout.variant": Use EXACTLY "single", "twoColumn", or "grid" (case-sensitive)
```

### 3. Defensive Code Improvements
Made `normalizeEmailPlan` function more resilient:
- Added optional chaining for `llmPlan.layout?.template`
- Made `inferLayoutVariant` accept optional template parameter
- Added fallback to `"single"` when layout is not provided

### 4. Additional Robustness
Made prompt construction more defensive:
- `plan.subject?.primary || "Compelling subject line"` (fallback for missing subject)
- `plan.sections?.length || 3` (fallback for missing sections)

## Schema Reference
According to `lib/schemas/emailSpec.ts`, the `LayoutSchema` is defined as:

```typescript
export const LayoutSchema = z.discriminatedUnion("variant", [
  SingleLayoutSchema,      // { variant: "single" }
  TwoColumnLayoutSchema,   // { variant: "twoColumn", columns?: [...] }
  GridLayoutSchema,        // { variant: "grid", columns: 2 | 3, gap: number }
]);
```

## Testing
All tests in `lib/llm/__tests__/generateEmailSpec.test.ts` now pass, confirming:
- The system can handle incomplete plan objects gracefully
- The enhanced prompts provide clear guidance to the LLM
- The validation errors are properly handled in the repair loop

### Root Cause 2: JSON Syntax Error in System Prompt
**Critical Bug**: The system prompt contained a JSON syntax error:

```typescript
// BEFORE (Invalid - extra closing brace)
"layout": {
  "variant": "single" | "twoColumn" | "grid",
  ...
}
}  // <-- EXTRA BRACE HERE
}
]

// AFTER (Fixed)
"layout": {
  "variant": "single" | "twoColumn" | "grid",
  ...
}
}
]
```

This caused:
1. ✅ LLM to generate EmailSpec JSON with extra brace (following the template)
2. ❌ JSON.parse() to fail
3. ↩️ Retry with error message about invalid JSON
4. ♾️ LLM tries to fix but the template itself was wrong → infinite loop
5. ⏱️ Eventually hits 95-second timeout

## Expected Outcome
With these changes, the LLM should:
1. ✅ Generate correct `layout.variant` values on the first attempt
2. ✅ Generate valid JSON that parses successfully
3. ✅ If it makes an error, receive clear guidance on the repair attempt
4. ✅ Understand the exact case-sensitive format required
5. ✅ Have concrete examples to reference
6. ✅ Complete generation within reasonable time (typically 10-30 seconds)

The errors should no longer occur:
- ❌ "Same validation errors appeared multiple times: sections.4.layout.variant: Invalid input"
- ❌ Infinite loop / timeout during generation
