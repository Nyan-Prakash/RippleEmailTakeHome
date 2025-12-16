# Font Source URL Implementation Fix

## Problem
The system was detecting custom fonts like "Inter" from brand websites but not including the font source URLs (like Google Fonts links) in the EmailSpec. This caused warnings in the renderer:
```
FONT_NO_SOURCE: Heading font "Inter" provided but no font source URL; most clients will fall back to system fonts.
```

## Solution Overview
Enhanced the font handling system across three key areas:

### 1. **Font Extraction (Scraper)**
**File**: `lib/scraper/extract/fonts.ts`

Added automatic Google Fonts URL generation for common web fonts:
- Maintains a list of popular Google Fonts (Inter, Roboto, Open Sans, etc.)
- Automatically generates proper Google Fonts URLs when these fonts are detected
- Falls back to detected stylesheet URLs if available
- Returns just the font name string if no source can be determined

```typescript
// Example output for Inter font:
{
  name: "Inter",
  sourceUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
}
```

### 2. **LLM Prompt Enhancement**
**File**: `lib/llm/generateEmailSpec.ts`

Added helper function to properly handle font objects:
```typescript
function getFontInfo(font: string | { name: string; sourceUrl?: string }): {
  name: string;
  sourceUrl?: string;
  displayString: string;
}
```

Updated all prompts to:
- Show the LLM the exact font format to use (string vs object with sourceUrl)
- Include example font objects with sourceUrls in the instructions
- Explicitly require object format when sourceUrl is available

### 3. **Schema Support**
**File**: `lib/schemas/brand.ts` (already had proper support)

The `BrandFontSchema` already supports both formats:
```typescript
z.union([
  z.string().trim().min(1),  // Simple string: "Inter"
  z.object({                  // Full object with source
    name: z.string(),
    sourceUrl: z.string().url().optional()
  })
])
```

## How It Works Now

### Font Extraction Flow
1. **Scrape Website** → Detects "Inter" is being used
2. **Check Font Sources**:
   - Looks for linked stylesheets (Google Fonts, Adobe Fonts, etc.)
   - Checks @font-face rules in CSS
   - Falls back to Google Fonts list for common fonts
3. **Build Font Object**:
   ```json
   {
     "name": "Inter",
     "sourceUrl": "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
   }
   ```

### EmailSpec Generation
1. **LLM receives brand context** with font object including sourceUrl
2. **Prompt explicitly shows format**:
   ```
   Heading: { "name": "Inter", "sourceUrl": "https://..." }
   Body: { "name": "Inter", "sourceUrl": "https://..." }
   ```
3. **LLM generates EmailSpec** using the exact format
4. **Validator checks** fonts match brand (already implemented)

### Email Rendering
1. **Renderer reads font object** from EmailSpec
2. **Injects @import or <link>** for the sourceUrl
3. **Applies font-family** to appropriate elements
4. **No warning** because source is available

## Common Google Fonts Supported

The system automatically generates URLs for these popular fonts:
- Inter
- Roboto
- Open Sans
- Lato
- Montserrat
- Poppins
- Raleway
- Source Sans Pro
- Work Sans
- Nunito
- PT Sans
- Rubik
- DM Sans
- Ubuntu
- Playfair Display
- Merriweather
- Oswald
- Mukta
- Manrope
- Space Grotesk
- Plus Jakarta Sans

## Testing

To test the fix:

1. **Scrape a brand using Inter or another Google Font**:
   ```bash
   # Through the UI or API
   POST /api/brand/ingest
   { "url": "https://example-with-inter.com" }
   ```

2. **Check the brandContext.brand.fonts**:
   ```json
   {
     "heading": {
       "name": "Inter",
       "sourceUrl": "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
     },
     "body": {
       "name": "Inter", 
       "sourceUrl": "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
     }
   }
   ```

3. **Generate EmailSpec** and verify the theme.font includes sourceUrl

4. **Render the email** - no FONT_NO_SOURCE warnings should appear

## Benefits

1. **No More Font Warnings**: Fonts with sources load properly in email clients
2. **Better Font Rendering**: Custom fonts display correctly instead of falling back to Arial
3. **Automatic Detection**: Works automatically for popular Google Fonts
4. **Backward Compatible**: Still works with string-only fonts for system fonts
5. **Brand Consistency**: Emails truly match the brand's typography

## Edge Cases Handled

- **System fonts** (Arial, Helvetica, etc.): Return as strings (no source needed)
- **Unknown custom fonts**: Return as strings, renderer shows warning (acceptable)
- **Multiple font sources**: Uses the first detected source (stylesheet, @import, or Google Fonts)
- **Font families with spaces**: Properly encoded in URLs (`Open Sans` → `Open+Sans`)

## Files Modified

1. `lib/scraper/extract/fonts.ts` - Added Google Fonts URL generation
2. `lib/llm/generateEmailSpec.ts` - Enhanced prompts to handle font objects
3. `FONT_SOURCE_FIX.md` - This documentation

## Future Enhancements

Potential improvements:
1. **Expand Google Fonts list** - Add more popular fonts as needed
2. **Adobe Fonts support** - Better handling of Typekit/Adobe Fonts
3. **Font weight detection** - Include specific weights in URLs
4. **Font validation** - Verify sourceUrls are accessible before using them
5. **Custom font upload** - Allow brands to upload their own font files
