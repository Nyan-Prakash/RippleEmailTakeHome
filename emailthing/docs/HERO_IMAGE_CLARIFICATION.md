# Hero Image Display Clarification

**Date:** December 15, 2025  
**Issue:** Documentation incorrectly stated hero images appear in both hero and header sections  
**Resolution:** Clarified that hero images only appear in header sections

## Current Implementation (Correct)

Hero images are **only displayed in header sections**, specifically:
- `header` sections
- `navHeader` sections  
- `announcementBar` sections

Hero images are **NOT displayed in**:
- `hero` sections
- Any other section types

## Code Location

**File:** `lib/render/mjml/renderEmailSpec.ts` (lines 248-251)

```typescript
// Check if this is a header section (not hero) and we have a hero image
const isHeaderSection = section.type === "header" || section.type === "navHeader" || section.type === "announcementBar";
const shouldShowHeroImage = isHeaderSection && brandContext?.brand?.heroImage;
const heroImage = shouldShowHeroImage ? brandContext?.brand?.heroImage : null;
```

## Rationale

This design is intentional because:
1. **Header sections** are typically at the top of the email and serve as the brand banner
2. **Hero sections** are content-focused areas that may contain their own imagery via image blocks
3. Automatically injecting hero images into hero sections would conflict with custom content design
4. Having the hero image in the header provides consistent brand presence without interfering with content

## Documentation Updated

Updated the following files to reflect the correct behavior:
- `HERO_IMAGE_FEATURE.md` - Fixed all references to clarify header-only display
- `spec/spec.md` - Updated Hero Image Integration section
- `lib/llm/planEmail.ts` - Updated prompt to mention header sections only

## Verification

The implementation has been correct since the feature was introduced. Only the documentation needed correction to match the actual behavior.
