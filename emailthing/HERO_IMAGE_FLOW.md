# Hero Image Display Logic - Quick Reference

## Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       EMAIL LAYOUT                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │  HEADER SECTION (at top)                          │    │
│  │  Shows: Brand Hero Image ONLY                     │    │
│  │  Source: brandContext.brand.heroImage             │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │  HERO SECTION (marketing content)                 │    │
│  │  Shows: Product Image OR Brand Hero Image         │    │
│  │  Priority:                                         │    │
│  │    1. First product image from catalog            │    │
│  │    2. Brand hero image (if no product)            │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  [Other sections: body, products, FAQ, footer...]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Decision Tree

```
┌─────────────────┐
│  Section Type?  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    v         v
┌─────┐   ┌──────┐
│Hero │   │Header│
└──┬──┘   └───┬──┘
   │          │
   │          └─────────────────────┐
   │                                │
   v                                v
┌────────────────────┐   ┌──────────────────────┐
│Has Product Image?  │   │Has Brand Hero Image? │
└─────┬──────────────┘   └──────────┬───────────┘
      │                             │
  ┌───┴───┐                     ┌───┴───┐
  │       │                     │       │
  v       v                     v       v
 YES     NO                    YES     NO
  │       │                     │       │
  v       v                     v       v
Show    Has Brand          Show Brand  No Image
Product  Hero Image?        Hero Image
Image      │
          v
      ┌───┴───┐
      │       │
      v       v
     YES     NO
      │       │
      v       v
   Show    Has Web
   Brand   Searched
   Hero    Image?
   Image      │
             v
         ┌───┴───┐
         │       │
         v       v
        YES     NO
         │       │
         v       v
      Show    No Image
      Found
      Image
```

## Image Source Priority

### Header Section (Top of Email)
```
1. Brand Hero Image ─► Display
   └─► If missing ──► No image
```

### Hero Section (Marketing Content)
```
1. First Product Image ─► Display
   └─► If missing ──────┐
                        v
2. Brand Hero Image ────► Display
   └─► If missing ──────┐
                        v
3. Web Searched Image ──► Display
   └─► If missing ──────► No image
```

## Code Reference

### Rendering (`renderEmailSpec.ts`)
```typescript
// Line ~355-380
const isHeroSection = section.type === "hero";
const isHeaderSection = section.type === "header" || 
                        section.type === "navHeader" || 
                        section.type === "announcementBar";

if (isHeroSection && brandContext) {
  // Product image > Brand hero image
  if (firstProduct?.image) {
    heroImageToShow = { url: productImage, ... };
  } else if (brandContext.brand.heroImage) {
    heroImageToShow = brandContext.brand.heroImage;
  }
} else if (isHeaderSection && brandContext?.brand?.heroImage) {
  // Brand hero image only
  heroImageToShow = brandContext.brand.heroImage;
}
```

### Brand Ingestion (`scraper/index.ts`)
```typescript
// Line ~158-186
// Step 9.6: If no hero image and no products, search web
if (!finalHeroImage && uniqueProducts.length === 0) {
  const brandImage = await searchForBrandImage(
    page, 
    brandName, 
    websiteUrl
  );
  if (brandImage) {
    finalHeroImage = { url: brandImage, alt: `${brandName}` };
  }
}
```

### Web Search (`scraper/webSearch.ts`)
```typescript
// New function: searchForBrandImage()
// - Searches: "BrandName store products lifestyle -logo"
// - Filters: Excludes logos, icons, social media
// - Validates: Minimum 500x300 pixels
// - Returns: Best quality brand image found
```

## Common Scenarios

| Scenario | Header Section | Hero Section |
|----------|---------------|--------------|
| **E-commerce with products** | Brand hero image | First product image |
| **E-commerce, no products** | Brand hero image | Brand hero image |
| **Service site with hero** | Brand hero image | Brand hero image |
| **New site, no hero, no products** | Web-searched image | Web-searched image |
| **No images anywhere** | No image | No image |

## Key Points

1. ✅ **Header sections** = Brand hero image ONLY
2. ✅ **Hero sections** = Product image preferred, then brand hero
3. ✅ **Web search** = Automatic fallback for missing images
4. ✅ **Graceful degradation** = No errors if images unavailable

## Testing

All tests passing ✅
- FAQ rendering: 10/10 tests
- Email spec rendering: All tests pass
- Backward compatible with existing emails
