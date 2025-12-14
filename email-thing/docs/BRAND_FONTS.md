# Brand Font Support

This document describes the brand font support feature, which allows emails to render in custom brand fonts when font source URLs are available.

## Overview

The email generator now supports loading and applying custom brand fonts in rendered emails. When a brand's typography includes font source URLs (e.g., Google Fonts, Adobe Fonts), the system will:

1. **Load the font** via `<mj-font>` tags in the MJML head
2. **Apply it globally** via `<mj-attributes>` for body font and CSS classes for heading font
3. **Use fallback stacks** for unsupported email clients
4. **Add validation warnings** when fonts are specified without source URLs

## Data Model

### BrandContext Typography

The `BrandContext.brand.fonts` field now supports two formats:

**String format (legacy):**
```typescript
{
  heading: "Geograph",
  body: "Inter"
}
```

**Object format with sourceUrl:**
```typescript
{
  heading: {
    name: "Geograph",
    sourceUrl: "https://fonts.googleapis.com/css2?family=Geograph"
  },
  body: {
    name: "Inter",
    sourceUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;700"
  }
}
```

Both formats are supported and can be mixed:
```typescript
{
  heading: {
    name: "Geograph",
    sourceUrl: "https://fonts.googleapis.com/css2?family=Geograph"
  },
  body: "Arial" // System font, no sourceUrl needed
}
```

### EmailSpec Theme Fonts

The `EmailSpec.theme.font` field follows the same pattern as BrandContext:

```typescript
{
  theme: {
    font: {
      heading: "Geograph" | { name: "Geograph", sourceUrl: "..." },
      body: "Inter" | { name: "Inter", sourceUrl: "..." }
    }
  }
}
```

## Font Extraction

The brand scraper (`lib/scraper/extract/fonts.ts`) attempts to detect and extract font source URLs from brand websites:

### Detection Strategies

1. **Link tags**: Scans `<link rel="stylesheet">` tags for common font services:
   - `fonts.googleapis.com` (Google Fonts)
   - `fonts.adobe.com` (Adobe Fonts)
   - `use.typekit.net` (Adobe Typekit)
   - `cloud.typography.com` (Typography.com)

2. **@font-face rules**: Examines CSS stylesheets for `@font-face` declarations and extracts font URLs

3. **@import rules**: Checks for CSS `@import` statements loading font stylesheets

### Limitations

- Cannot extract fonts from CORS-protected stylesheets
- Only captures publicly accessible font URLs
- Does not download font binaries, only CSS URLs
- Falls back to font name only when source URL cannot be determined

## MJML Rendering

The MJML renderer (`lib/render/mjml/renderEmailSpec.ts`) handles font injection and application:

### Font Stack Generation

All fonts use a comprehensive fallback stack:

```
[Font Name], -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif
```

This ensures emails render acceptably even when:
- Custom fonts fail to load
- Email clients don't support web fonts
- Font URLs become unavailable

### Font Injection

When a `sourceUrl` is provided, the renderer injects `<mj-font>` tags:

```xml
<mj-head>
  <mj-font name="Geograph" href="https://fonts.googleapis.com/css2?family=Geograph" />
  <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter" />
  <!-- ... -->
</mj-head>
```

Duplicate font tags are avoided when heading and body fonts are identical.

### Font Application

**Body font** is applied via:
- `<mj-all font-family="...">` for global default
- `<mj-button font-family="...">` for button elements

**Heading font** is applied via:
- CSS class `.heading { font-family: ... }`
- Used by all heading blocks

Example MJML output:

```xml
<mj-head>
  <mj-font name="Geograph" href="https://fonts.googleapis.com/css2?family=Geograph" />
  <mj-attributes>
    <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" />
    <mj-button font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" />
  </mj-attributes>
  <mj-style>
    .heading { font-family: Geograph, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
  </mj-style>
</mj-head>
```

## Validation

The validation system (`lib/validators/emailSpec.ts`) includes font-specific checks:

### Warnings

**`FONT_NO_SOURCE`**: Emitted when a custom font name is specified without a `sourceUrl`

```typescript
{
  code: "FONT_NO_SOURCE",
  severity: "warning",
  message: "Heading font \"Geograph\" provided but no font source URL; most email clients will fall back to system fonts",
  path: "theme.font.heading"
}
```

**`INVALID_FONT_URL`**: Emitted when a `sourceUrl` is provided but is not a valid URL

```typescript
{
  code: "INVALID_FONT_URL",
  severity: "warning",
  message: "Heading font source URL is invalid: not-a-url",
  path: "theme.font.heading.sourceUrl"
}
```

### Special Cases

- **Arial** and other system fonts do not trigger warnings when `sourceUrl` is absent
- Warnings are non-blocking; emails render regardless

## Email Client Compatibility

### Supported Clients

Modern email clients with web font support:
- Apple Mail
- iOS Mail
- Outlook for Mac
- Gmail (limited)
- Yahoo Mail

### Fallback Behavior

When fonts fail to load or are unsupported:
- System font stack is used automatically
- Email remains readable and on-brand
- Layout is unaffected

### Best Practices

1. **Always provide fallbacks**: The system handles this automatically
2. **Test font URLs**: Ensure they're publicly accessible
3. **Use common font services**: Google Fonts has widest compatibility
4. **Consider system fonts**: Arial, Helvetica work everywhere
5. **Check contrast**: Ensure readability with fallback fonts

## Usage Examples

### Example 1: Google Fonts

```typescript
const brandContext: BrandContext = {
  brand: {
    // ... other fields
    fonts: {
      heading: {
        name: "Montserrat",
        sourceUrl: "https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700"
      },
      body: {
        name: "Open Sans",
        sourceUrl: "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600"
      }
    }
  }
};
```

### Example 2: Adobe Fonts

```typescript
const brandContext: BrandContext = {
  brand: {
    // ... other fields
    fonts: {
      heading: {
        name: "Acumin Pro",
        sourceUrl: "https://use.typekit.net/abc1234.css"
      },
      body: "Arial" // System font for maximum compatibility
    }
  }
};
```

### Example 3: Same Font for Heading and Body

```typescript
const brandContext: BrandContext = {
  brand: {
    // ... other fields
    fonts: {
      heading: {
        name: "Inter",
        sourceUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700"
      },
      body: {
        name: "Inter",
        sourceUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700"
      }
    }
  }
};
```

## Testing

The brand font feature includes comprehensive test coverage:

### Test File

`lib/render/mjml/__tests__/brandFonts.test.ts`

### Test Coverage

- Font stack generation with fallbacks
- `<mj-font>` tag injection
- Global font application via `<mj-all>`
- Heading font application via CSS class
- Duplicate font tag prevention
- Warning generation for missing sourceUrl
- Mixed string/object font definitions
- HTML escaping in font names

### Running Tests

```bash
npm test -- lib/render/mjml/__tests__/brandFonts.test.ts
```

## Schema Changes

### New Types

**`BrandFont`** (`lib/schemas/brand.ts`):
```typescript
type BrandFont = {
  name: string;
  sourceUrl?: string;
};
```

**`FontDef`** (`lib/schemas/emailSpec.ts`):
```typescript
type FontDef = {
  name: string;
  sourceUrl?: string;
};
```

### Updated Schemas

**`BrandFontsSchema`**:
```typescript
z.object({
  heading: z.union([z.string(), BrandFontSchema]),
  body: z.union([z.string(), BrandFontSchema])
})
```

**`FontConfigSchema`**:
```typescript
z.object({
  heading: z.union([z.string(), FontDefSchema]),
  body: z.union([z.string(), FontDefSchema])
})
```

## Implementation Notes

### Backward Compatibility

The system maintains full backward compatibility with existing code:
- String font definitions continue to work
- Existing EmailSpecs render unchanged
- No breaking changes to APIs or schemas

### Font URL Security

The system does NOT:
- Download or host font files
- Execute arbitrary CSS
- Follow redirects
- Validate font file contents

Font URLs are passed directly to email clients, which handle loading and rendering according to their own security policies.

### Performance

Font injection has minimal performance impact:
- No additional network calls during rendering
- Font loading occurs client-side in email clients
- Fallback fonts prevent rendering delays

## Future Enhancements

Potential improvements for future iterations:

1. **Font weight mapping**: Extract and use specific font weights
2. **Font style support**: Handle italic/oblique variants
3. **Font preloading**: Add `<link rel="preload">` for faster loading
4. **Font subsetting**: Recommend subsetting for smaller file sizes
5. **Self-hosted fonts**: Support for custom font CDNs
6. **Font pairing suggestions**: AI-powered font combination recommendations

## Troubleshooting

### Fonts not rendering in preview

1. Check that `sourceUrl` is publicly accessible
2. Verify URL points to a CSS file (not a font file directly)
3. Ensure no CORS restrictions on font URL
4. Test URL in browser to confirm it loads

### Validation warnings

1. **FONT_NO_SOURCE**: Add `sourceUrl` or switch to system font
2. **INVALID_FONT_URL**: Check URL format and accessibility
3. **THEME_FONT_DRIFT**: Font in EmailSpec differs from BrandContext

### Fallback fonts always used

1. Some email clients don't support web fonts (e.g., Outlook 2007-2019)
2. Font URL may be blocked by client security policies
3. Font loading may have failed silently
4. This is expected behavior for older clients

## References

- [MJML Font Documentation](https://documentation.mjml.io/#mj-font)
- [Email Client CSS Support](https://www.campaignmonitor.com/css/)
- [Google Fonts](https://fonts.google.com/)
- [Adobe Fonts](https://fonts.adobe.com/)
