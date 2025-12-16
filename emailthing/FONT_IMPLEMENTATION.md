# Brand Font Implementation

## Overview
The email generation system now ensures that emails use the exact fonts from the brand context. Each brand's unique typography is preserved throughout the entire email generation and rendering process.

## How It Works

### 1. Font Extraction (Brand Ingestion)
When a brand's website is scraped, the system extracts:
- **Heading font**: Used for h1, h2, h3 elements
- **Body font**: Used for paragraphs and other text

Example from `brandContext`:
```json
{
  "brand": {
    "fonts": {
      "heading": "Inter, sans-serif",
      "body": "Inter, sans-serif"
    }
  }
}
```

### 2. EmailSpec Generation (LLM)
The LLM is now explicitly instructed to use the exact brand fonts:
- System prompt specifies: `"font": { "heading": "string (use brand.fonts.heading)", "body": "string (use brand.fonts.body)" }`
- User prompt includes: `theme.font.heading = "${brandContext.brand.fonts.heading}"` and `theme.font.body = "${brandContext.brand.fonts.body}"`
- Critical rule #5: **USE BRAND FONTS**: theme.font.heading MUST be the exact value from brandContext.brand.fonts.heading

### 3. Validation
The validator checks for font consistency:
```typescript
const brandHeadingFont = brandContext.brand.fonts.heading.toLowerCase();
const specHeadingFont = spec.theme.font.heading.toLowerCase();

if (!specHeadingFont.includes(brandHeadingFont.split(',')[0].trim().toLowerCase())) {
  // Warning: font drift detected
}
```

### 4. Rendering
The MJML renderer applies the fonts:
```mjml
<mj-all font-family="${theme.font.body}, Arial, sans-serif" />
<style>
  .heading { font-family: ${theme.font.heading}, Arial, sans-serif; }
</style>
```

## Example Flow

### Input: Brand Context
```json
{
  "brand": {
    "name": "Acme Co",
    "fonts": {
      "heading": "Playfair Display, serif",
      "body": "Open Sans, sans-serif"
    }
  }
}
```

### Output: EmailSpec Theme
```json
{
  "theme": {
    "font": {
      "heading": "Playfair Display, serif",
      "body": "Open Sans, sans-serif"
    }
  }
}
```

### Rendered Email
- All headings use: `Playfair Display, serif`
- All body text uses: `Open Sans, sans-serif`
- Fallback fonts (Arial, sans-serif) are automatically added for email client compatibility

## Testing

To verify font implementation:
```bash
npm test -- lib/llm/__tests__/generateEmailSpec.test.ts --run
```

All tests pass with the font implementation. The mock data uses Arial fonts, and the system correctly applies them throughout the generation process.

## Benefits

1. **Brand Consistency**: Each email automatically matches the brand's typography
2. **No Manual Configuration**: Fonts are extracted during brand ingestion
3. **Validation**: System warns if generated specs deviate from brand fonts
4. **Fallback Support**: Email clients without custom fonts fall back to safe defaults

## Files Modified
- `lib/llm/generateEmailSpec.ts`: Added explicit font instructions in prompts
  - System prompt (line 317)
  - Critical rules (line 392)
  - User prompt requirements (line 526)
  - Repair instructions (line 561)
