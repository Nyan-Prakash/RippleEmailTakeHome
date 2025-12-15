# N/A Price Display Control Feature

## Overview

This feature prevents products with missing or unavailable prices from displaying price text in email product cards. When a product has a price of "N/A" (case-insensitive) or an empty string, the price element is completely omitted from the rendered email.

## Implementation Date
2025-12-13

## User Request
"Can you make it so if the price is N/A then it won't display the font but if the price is there it will display it"

## Technical Implementation

### Modified Files

#### 1. `lib/render/mjml/renderEmailSpec.ts` (Lines 617-620)

**Before:**
```typescript
if (product.price) {
  // Render price text
}
```

**After:**
```typescript
if (product.price && product.price !== "N/A" && product.price.trim().toLowerCase() !== "n/a") {
  // Render price text
}
```

**Logic:**
- Checks if price exists (truthy)
- Filters out uppercase "N/A"
- Filters out lowercase "n/a" with trimmed whitespace
- Only renders price text if all conditions pass

### Behavior

#### Products WITH Valid Prices
```
┌─────────────────────┐
│   Product Image     │
├─────────────────────┤
│  Product Title      │
├─────────────────────┤
│  $99.99            │ ← Price displays
├─────────────────────┤
│  [View Product]     │
└─────────────────────┘
```

#### Products WITHOUT Valid Prices (N/A or empty)
```
┌─────────────────────┐
│   Product Image     │
├─────────────────────┤
│  Product Title      │
├─────────────────────┤
│                     │ ← No price element
├─────────────────────┤
│  [View Product]     │
└─────────────────────┘
```

## Test Coverage

Created comprehensive test suite: `lib/render/mjml/__tests__/productPriceRendering.test.ts`

### Test Cases (7 total - all passing ✓)

1. **Valid Price Display** - Verifies products with valid prices show the price text
2. **N/A Uppercase Filtering** - Ensures "N/A" (uppercase) is not rendered
3. **n/a Lowercase Filtering** - Ensures "n/a" (lowercase) is not rendered  
4. **Empty Price Handling** - Ensures empty strings don't render price element
5. **Component Rendering** - Verifies image, title, and button still render without price
6. **Proper Spacing** - Ensures layout maintains structure without price element
7. **Mixed Products** - Validates mixed products (with/without prices) in same section

### Test Results
```bash
✓ lib/render/mjml/__tests__/productPriceRendering.test.ts (7 tests) 6ms
  ✓ Product Card Price Rendering (7)
    ✓ should display price when product has valid price 2ms
    ✓ should NOT display N/A price (uppercase) 1ms
    ✓ should NOT display n/a price (lowercase) 1ms
    ✓ should NOT display empty price 0ms
    ✓ should render all product components except price for N/A products 0ms
    ✓ should maintain proper spacing without price element 0ms
    ✓ should handle mixed products with and without prices in same section 1ms
```

## Edge Cases Handled

| Input Price | Behavior | Reason |
|------------|----------|---------|
| `"$99.99"` | ✅ Displays | Valid price |
| `"N/A"` | ❌ Hidden | Uppercase N/A |
| `"n/a"` | ❌ Hidden | Lowercase n/a |
| `""` | ❌ Hidden | Empty string |
| `"  n/a  "` | ❌ Hidden | Trimmed lowercase |
| `"  N/A  "` | ❌ Hidden | Trimmed uppercase |
| `undefined` | ❌ Hidden | Falsy value |
| `null` | ❌ Hidden | Falsy value |

## Business Impact

### Benefits
1. **Improved Visual Quality** - No confusing "N/A" text in customer emails
2. **Professional Appearance** - Clean product cards without placeholder text
3. **Better UX** - Users see products even when prices aren't available
4. **Flexible Catalog** - Can include products awaiting price updates

### Use Cases
- Pre-launch products (coming soon)
- Out of stock items without pricing
- Custom quote products (call for price)
- Region-specific pricing (not available in customer's location)
- Temporary price removal during sales preparation

## Integration Notes

### MJML Output
When price is filtered out, the MJML structure changes from:

```xml
<mj-column>
  <mj-image src="..." />
  <mj-text>Product Title</mj-text>
  <mj-text font-weight="bold" font-size="18px">$99.99</mj-text>
  <mj-button>View Product</mj-button>
</mj-column>
```

To:

```xml
<mj-column>
  <mj-image src="..." />
  <mj-text>Product Title</mj-text>
  <!-- Price element completely omitted -->
  <mj-button>View Product</mj-button>
</mj-column>
```

### Backward Compatibility
- ✅ Existing emails with valid prices: No change
- ✅ Existing rendering logic: Fully compatible
- ✅ Product scraping: Works with enhanced scraper (N/A detection)
- ✅ Schema validation: No schema changes required

## Related Features

### Product Scraping Enhancement
The enhanced product scraper (`lib/scraper/extract/products.ts`) now returns "N/A" when it cannot detect a price:

```typescript
{
  title: "Product Name",
  price: "N/A", // ← Scraper sets this when price not found
  url: "https://...",
  imageUrl: "https://..."
}
```

This integrates seamlessly with the price display control:
1. Scraper detects no price → returns "N/A"
2. Renderer receives "N/A" → omits price element
3. Email displays cleanly without price

### Email Spec Validation
No changes required to schemas. The `ProductItem` type already supports optional pricing:

```typescript
type ProductItem = {
  title: string;
  price?: string; // Optional, can be any string including "N/A"
  imageUrl?: string;
  url: string;
}
```

## Performance Impact

- **Minimal** - Single string comparison added to existing conditional
- **No rendering overhead** - Actually reduces MJML elements when price is N/A
- **Test execution** - 7 new tests add ~6ms to test suite

## Future Enhancements

Potential improvements for consideration:

1. **Custom Messaging** - Allow brands to specify custom text for missing prices
   ```typescript
   priceUnavailableText?: string; // "Call for Price", "Coming Soon", etc.
   ```

2. **Internationalization** - Handle more price absence indicators
   ```typescript
   const priceAbsencePatterns = ["N/A", "n/a", "NA", "TBD", "TBA", "Coming Soon"];
   ```

3. **Analytics** - Track how often N/A prices appear in campaigns
   ```typescript
   metrics.productsPriceUnavailable++;
   ```

4. **Warnings** - Optionally warn when many products lack prices
   ```typescript
   if (productsWithoutPrice.length > totalProducts * 0.5) {
     warnings.push("More than 50% of products missing prices");
   }
   ```

## Testing Recommendations

When modifying product card rendering:

1. **Run Price Tests**: `npm test -- lib/render/mjml/__tests__/productPriceRendering.test.ts --run`
2. **Check Render Tests**: `npm test -- lib/render/mjml/__tests__/renderEmailSpec.test.ts --run`
3. **Visual Inspection**: Generate test email with mixed price/no-price products
4. **Cross-Client Test**: Verify layout in Gmail, Outlook, Apple Mail

## Documentation Updates

Files updated to document this feature:
- ✅ This file (`PRICE_DISPLAY_FEATURE.md`)
- ✅ Test suite (`productPriceRendering.test.ts`)
- ✅ Implementation (`renderEmailSpec.ts` with inline comments)

## Conclusion

The N/A price display control feature provides a clean, professional solution for handling products with unavailable pricing information. It integrates seamlessly with the enhanced product scraping system and maintains full backward compatibility while improving the email rendering experience.

**Status**: ✅ Complete and Tested
**Tests**: ✓ 7/7 passing
**Regression Tests**: ✓ 7/7 passing
**Impact**: Minimal code change, significant UX improvement
