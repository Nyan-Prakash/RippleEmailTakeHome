# Hero Image Feature Implementation

## Overview
This feature automatically extracts and displays hero/banner images from brand websites during scraping, then displays them prominently in the email hero sections and brand profile.

## What Was Added

### 1. Brand Schema Enhancement
- **File**: `lib/schemas/brand.ts`
- Added `HeroImageSchema` with `url` and `alt` fields
- Updated `BrandSchema` to include optional `heroImage` field

### 2. Hero Image Extractor
- **File**: `lib/scraper/extract/heroImage.ts`
- New intelligent extractor that identifies hero/banner images from websites
- Scoring algorithm that prioritizes:
  - Images with "hero" or "banner" in class/id/src
  - Images inside hero/banner sections
  - Large, wide images (typical hero aspect ratios)
  - Open Graph images
  - Penalizes logos, products, and small images

### 3. Scraper Integration
- **File**: `lib/scraper/index.ts`
- Integrated `extractHeroImage()` in main scraping flow
- Hero image is extracted alongside logo, colors, and fonts
- Included in the final `BrandContext` object

### 4. Brand Profile UI
- **File**: `app/components/BrandProfile.tsx`
- Displays hero image prominently at the top with a badge
- Full-width, 192px tall image with rounded corners
- Graceful error handling if image fails to load

### 5. Email Rendering
- **File**: `lib/render/mjml/renderEmailSpec.ts`
- Updated `renderEmailSpecToMjml()` to accept optional `brandContext`
- Automatically injects hero image at top of hero/header/navHeader sections
- Uses fluid-on-mobile for responsive display
- Proper spacing with section content

### 6. LLM Prompts
- **Files**: `lib/llm/planEmail.ts`, `lib/llm/generateEmailSpec.ts`
- Updated prompts to mention hero image availability
- LLMs are informed when a hero image is available for use in hero sections

### 7. API Route
- **File**: `app/api/email/render/route.ts`
- Updated to accept optional `brandContext` in request body
- Passes brandContext through to renderer

### 8. UI Integration
- **File**: `app/page.tsx`
- Updated email render call to include `brandContext`
- Hero images automatically appear in preview when available

## How It Works

### Brand Ingestion Flow
1. User enters website URL
2. Scraper extracts brand information including hero image
3. Hero image is displayed in Brand Profile section
4. BrandContext with hero image is stored in component state

### Email Generation Flow
1. User creates campaign intent
2. LLM generates email plan (informed about hero image availability)
3. LLM generates email spec with hero section
4. When rendering, hero image is automatically injected into hero/header sections
5. Final email displays beautiful hero image at top

### Automatic Hero Image Display
Hero images are automatically shown in these section types:
- `hero` - Main hero section
- `header` - Standard header
- `navHeader` - Navigation header

The image appears:
- At the very top of the section (before other blocks)
- Full width and fluid on mobile
- With proper alt text from brand name
- With spacing between image and content

## Visual Impact

### Brand Profile
- Large hero image (full width, 192px tall)
- "Hero Image" badge overlay
- Shows before logo and other brand details

### Email Preview
- Hero image automatically appears in hero sections
- Responsive and mobile-friendly
- Professional appearance matching brand website

## Error Handling
- If hero image extraction fails, scraping continues normally
- If hero image fails to load in UI, element is hidden
- No hero image = normal email without it (graceful degradation)

## Benefits
1. **Automatic**: No manual upload needed
2. **Brand Consistency**: Uses actual hero image from brand website
3. **Professional**: Emails look more polished and on-brand
4. **Visual Impact**: Hero images grab attention and set tone
5. **Responsive**: Works on all device sizes

## Future Enhancements
- Allow manual hero image upload/override
- Support for multiple hero images (A/B testing)
- Image optimization and CDN integration
- Fallback to best product image if no hero found
