# Font Override Feature

## Overview
Added a font selector dropdown in the email preview that allows you to override and test different fonts without regenerating the EmailSpec. This is perfect for quickly experimenting with typography choices.

## Feature Details

### Location
The font selector appears in the **Email Preview** section, right above the email preview iframe.

### How It Works

1. **Select a Font**: Choose from 25+ popular fonts in the dropdown
2. **Live Preview**: The email preview updates instantly with the new font
3. **Reset**: Click the "Reset" button to return to the original fonts from the EmailSpec
4. **Non-Destructive**: The font override is preview-only and doesn't modify the actual EmailSpec

### Available Fonts

**Google Fonts (with automatic web font loading):**
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

**System Fonts:**
- Arial
- Helvetica
- Times New Roman
- Georgia

## Technical Implementation

### Component: `EmailPreview.tsx`

**Key Features:**
1. **Font Selector State**: Uses React state to track selected font
2. **HTML Modification**: Uses `useMemo` to efficiently modify HTML when font changes
3. **Google Fonts Loading**: Automatically injects Google Fonts link tags for custom fonts
4. **CSS Override**: Injects inline styles with `!important` to override all fonts in the email

**Code Flow:**
```typescript
// 1. User selects font from dropdown
setSelectedFont("Inter")

// 2. useMemo recalculates modified HTML
const modifiedHtml = useMemo(() => {
  // Inject Google Fonts link
  const fontLink = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">`
  
  // Inject override styles
  const styleOverride = `<style>* { font-family: Inter, Arial, sans-serif !important; }</style>`
  
  // Insert into HTML before </head>
  return html.replace('</head>', `${fontLink}${styleOverride}</head>`)
}, [html, selectedFont])

// 3. iframe renders with new font
<iframe srcDoc={modifiedHtml} />
```

## User Interface

### Font Selector Bar
- **Blue background** with light border for visibility
- **Emoji icon** (🎨) for visual appeal
- **Dropdown** with clear label "Override Font:"
- **Reset button** appears when font is selected

### Confirmation Message
When a font is selected, a **green success message** appears:
```
✓ Preview now using [Font Name] for all text. This override is for testing only 
  and doesn't modify the EmailSpec.
```

This makes it crystal clear that the change is preview-only.

## Use Cases

### 1. **A/B Testing Typography**
Quickly test how different fonts affect the email's appearance without regenerating specs:
- Try serif vs sans-serif
- Compare modern fonts (Inter, DM Sans) vs traditional (Times New Roman, Georgia)
- Test readability with different font families

### 2. **Client Presentations**
Show clients multiple font options in real-time:
- Present the brand font (from spec)
- Show alternatives instantly
- Make quick design decisions

### 3. **Font Validation**
Verify fonts work correctly in email context:
- Test Google Fonts loading
- Check font rendering in iframe
- Ensure proper fallbacks

### 4. **Design Experimentation**
Explore typography without touching the EmailSpec:
- Safe experimentation
- No need to re-run LLM
- Instant feedback

## Benefits

✅ **Fast Iteration**: Test fonts in seconds, not minutes  
✅ **Non-Destructive**: Original EmailSpec remains unchanged  
✅ **Easy to Use**: Simple dropdown interface  
✅ **Web Font Support**: Automatic Google Fonts loading  
✅ **Clear Feedback**: Visual confirmation of active override  
✅ **Reversible**: One-click reset to original fonts  

## Limitations

- **Preview Only**: Font override is not saved to the EmailSpec
- **All Text Override**: Applies to all text elements (headings, body, etc.)
- **No Separate Heading/Body**: Overrides both heading and body fonts to the same family
- **iframe Only**: Override only visible in preview tab, not in HTML/MJML code views

## Future Enhancements

Potential improvements:
1. **Separate Controls**: Different dropdowns for heading vs body fonts
2. **Save Override**: Button to update the EmailSpec with the selected font
3. **Font Weights**: Select specific weights (400, 600, 700, etc.)
4. **Custom Fonts**: Allow entering custom font URLs
5. **Font Comparison**: Side-by-side preview with different fonts
6. **History**: Remember recently used font overrides

## Files Modified

1. `app/components/EmailPreview.tsx` - Added font selector and HTML modification logic
2. `FONT_OVERRIDE_FEATURE.md` - This documentation

## Testing

To test the feature:

1. **Generate or paste an EmailSpec** through the UI
2. **Render the email preview**
3. **Look for the font selector** above the preview iframe (blue bar with 🎨 icon)
4. **Select a font** from the dropdown
5. **Observe**: Preview updates instantly with new font + green confirmation message
6. **Click Reset**: Returns to original fonts from EmailSpec
7. **Try different fonts**: Switch between Google Fonts and system fonts

## Example Workflow

```
1. User generates email with brand font "Roboto"
   → Email renders with Roboto

2. User selects "Inter" from dropdown
   → Preview instantly updates to Inter
   → Green message: "✓ Preview now using Inter..."

3. User likes Inter better
   → Can note this for next EmailSpec generation
   → Or manually edit the spec JSON

4. User clicks "Reset"
   → Preview returns to original Roboto
```
