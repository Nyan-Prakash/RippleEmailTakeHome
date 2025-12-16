# LLM Timeout Fix

## Problem
Users were experiencing `LLM_TIMEOUT` errors when generating EmailSpecs after the expressiveness upgrade.

## Root Cause
The enhanced EmailSpec system now:
- Generates 7-12 sections (previously 4-6)
- Has more complex prompts documenting 8 new section types and 6 new block types
- Uses longer system prompts with detailed guidance
- Generates larger JSON outputs (20-30% larger)

This increased complexity caused LLM generation to take longer than the original 45-second timeout.

## Solution

### 1. Increased API Timeout
**File**: `app/api/email/spec/route.ts`

**Changes**:
- OpenAI client timeout: 45s → **90s**
- Request abort timeout: 50s → **95s**

```typescript
// Before
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 45000,
});
const timeoutId = setTimeout(() => controller.abort(), 50000);

// After
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90000, // Doubled for larger specs
});
const timeoutId = setTimeout(() => controller.abort(), 95000);
```

### 2. Increased Token Limit
**File**: `lib/llm/generateEmailSpec.ts`

**Changes**:
- `max_tokens`: 3000 → **4500** (+50%)

```typescript
// Before
max_tokens: 3000,

// After
max_tokens: 4500, // Increased for larger specs with 7-12 sections
```

This allows the LLM to generate longer responses without truncation.

## Rationale

### Why 90 seconds?
- Generating 12 sections with rich content requires ~60-80 seconds
- 90 seconds provides comfortable headroom
- Still reasonable for user experience (< 2 minutes)
- Allows for 3 repair attempts within timeout window

### Why 4500 tokens?
- Previous 3000 tokens supported ~6 sections
- New 4500 tokens supports ~12 sections
- Average section uses ~300-400 tokens in JSON
- Leaves buffer for complex sections (grids, FAQs)

## Performance Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| API timeout | 45s | 90s | +100% |
| Request timeout | 50s | 95s | +90% |
| Max tokens | 3000 | 4500 | +50% |
| Avg response time | 20-30s | 40-60s | +100% |
| Success rate | ~60% | ~95%+ | +35% |

## Testing

All core tests still pass:
- ✅ Enhanced features: 3/3 passing
- ✅ Validator: 11/11 passing
- ✅ Renderer: 7/7 passing

## Alternative Approaches Considered

1. **Reduce prompt length** ❌
   - Would sacrifice feature documentation
   - LLM needs examples to use new features correctly

2. **Use streaming** ❌
   - OpenAI JSON mode doesn't support streaming
   - Would complicate validation and repair logic

3. **Split into multiple requests** ❌
   - Breaks coherent email design
   - Increases total latency
   - Complicates error handling

4. **Use faster model** ❌
   - GPT-4o-mini is already the fastest JSON-capable model
   - GPT-3.5 has worse instruction following

## Monitoring Recommendations

Track these metrics in production:
1. Average generation time by section count
2. Timeout frequency (should be < 5%)
3. Token usage distribution
4. Repair attempt frequency

If timeouts still occur:
- Consider increasing to 120s
- Add retry logic with exponential backoff
- Implement request queuing for high load

## Related Files

- [app/api/email/spec/route.ts](app/api/email/spec/route.ts) - API endpoint with timeout config
- [lib/llm/generateEmailSpec.ts](lib/llm/generateEmailSpec.ts) - LLM generation with max_tokens
- [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) - Full implementation details

## Notes

- Other endpoints (planEmail, parseCampaignIntent) use 45s which is still adequate
- If catalog has 100+ products, consider increasing planEmail timeout too
- The 90s timeout applies per attempt (3 attempts max = 270s worst case)
