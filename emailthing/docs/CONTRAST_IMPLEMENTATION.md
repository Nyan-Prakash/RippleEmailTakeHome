# Automatic Contrast Implementation

## Overview
Updated the email generation system to ensure proper text and button contrast against backgrounds, preventing issues like black text on black backgrounds or white text on white backgrounds.

## Changes Made

### 1. LLM Prompt Updates (`lib/llm/generateEmailSpec.ts`)

Added explicit instructions to the LLM prompt system about automatic contrast handling:

#### System Prompt (buildSystemPrompt)
- **Rule 5**: Added emphasis that contrast is automatic - the system calculates contrasting text colors for each background
- Dark backgrounds (primary, accent) automatically get light text
- Light backgrounds (bg, surface) automatically get dark text
- LLM only needs to specify background tokens; text colors are calculated automatically
- Standards: WCAG AA 4.5:1 for text, 3:1 for buttons

#### First Attempt Prompt (buildUserPrompt - attempt 1)
Added to REQUIREMENTS section:
- **TEXT CONTRAST IS AUTOMATIC**: Only specify `section.style.background`. The renderer automatically calculates contrasting text colors to meet WCAG AA standards
- Explicitly tells LLM NOT to manually set text colors

#### Repair Prompt (buildUserPrompt - attempts 2-3)
Added to CRITICAL REPAIR INSTRUCTIONS:
- **TEXT CONTRAST**: DO NOT manually set text colors. System automatically ensures proper contrast
- Final attempt reminder: text and button colors are automatically calculated - only specify background tokens

## How It Works

### Backend System (Already Implemented)
The rendering system in `lib/theme/deriveTheme.ts` and `lib/render/mjml/styleHelpers.ts` already handles:

1. **`enhanceThemeWithAccessibleColors()`**: Calculates accessible text colors for all background tokens
   - Uses `getReadableTextColor()` to ensure WCAG AA 4.5:1 contrast for text
   - Uses `getButtonColors()` to ensure WCAG AA 3:1 contrast for buttons
   
2. **`resolveSectionTextColor()`**: Automatically selects the right text color based on section background
   - Maps each background token (bg, surface, muted, primary, accent, etc.) to its accessible text color
   - Falls back to calculating contrast if needed

3. **Contrast Calculation Functions**:
   - `getLuminance()`: Calculates color luminance (WCAG 2.0)
   - `getContrastRatio()`: Calculates contrast ratio between two colors
   - Automatically adjusts colors if contrast is insufficient

### LLM Integration (Updated)
The LLM now understands that:
- It should only specify `section.style.background` using palette tokens
- Text colors will be automatically calculated by the rendering system
- This prevents the LLM from making poor contrast choices

## Examples

### Dark Background
```json
{
  "id": "hero-01",
  "type": "hero",
  "style": {
    "background": "primary"  // Dark color
    // Text color automatically set to light/white for contrast
  }
}
```

### Light Background
```json
{
  "id": "features-01",
  "type": "feature",
  "style": {
    "background": "bg"  // Light color
    // Text color automatically set to dark/black for contrast
  }
}
```

### Buttons
Buttons automatically receive contrasting text colors:
- Primary button on dark palette → light text
- Primary button on light palette → dark text
- System ensures minimum 3:1 contrast ratio (WCAG AA for UI components)

## Testing

To test the contrast system:
1. Generate an email with mixed backgrounds (light and dark)
2. Verify that text is always readable against its background
3. Check that buttons have proper contrast
4. Use browser developer tools to verify WCAG AA compliance

## Benefits

1. **Accessibility**: Ensures WCAG AA compliance automatically
2. **Consistency**: All emails follow the same contrast standards
3. **Simplicity**: LLM only needs to think about backgrounds, not text colors
4. **Reliability**: Prevents human error in color selection
5. **Maintainability**: Single source of truth for contrast calculations

## Standards Compliance

- **WCAG AA Text**: 4.5:1 minimum contrast ratio
- **WCAG AA Large Text**: 3:1 minimum contrast ratio
- **WCAG AA UI Components**: 3:1 minimum contrast ratio (buttons, icons)

The system automatically enforces these standards for all generated content.
