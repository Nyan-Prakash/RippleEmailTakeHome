# Debug Logging for Email Spec Generation

## Overview
Comprehensive debug logging has been added to `generateEmailSpec.ts` to diagnose infinite loop and stuck generation issues.

## Log Levels

### Function Start
```
[generateEmailSpec] ========== STARTING EMAIL SPEC GENERATION ==========
[generateEmailSpec] Brand: {name}
[generateEmailSpec] Intent type: {type}
[generateEmailSpec] Plan has {n} sections
[generateEmailSpec] Normalizing schemas...
[generateEmailSpec] Schemas normalized successfully
```

### Attempt Loop
```
[generateEmailSpec] Starting attempt {n}/3
[generateEmailSpec] Building prompts for attempt {n}
[generateEmailSpec] Calling LLM with temperature {temp}
```

### LLM Response
```
[generateEmailSpec] LLM response received, attempt {n}
[generateEmailSpec] Parsing JSON response (length: {bytes})
```

### JSON Parsing
**Success:**
```
[generateEmailSpec] JSON parsed successfully
```

**Failure:**
```
[generateEmailSpec] JSON parse error on attempt {n}: {error}
[generateEmailSpec] First 200 chars of content: {preview}
```

### Zod Validation
**Success:**
```
[generateEmailSpec] Validating with Zod schema
[generateEmailSpec] Zod validation passed
```

**Failure:**
```
[generateEmailSpec] Zod validation failed on attempt {n}:
  1. {error1}
  2. {error2}
[generateEmailSpec] Error signature added to history. Total unique errors: {n}
```

**Repeated Error:**
```
[generateEmailSpec] Repeated error detected: {signature}
```

### Structural Validation
```
[generateEmailSpec] Running structural validation
[generateEmailSpec] Structural validation complete: {errors} errors, {warnings} warnings
```

**Errors:**
```
[generateEmailSpec] Structural errors on attempt {n}:
  1. [{CODE}] {message}
[generateEmailSpec] Structural error signature added to history. Total unique errors: {n}
[generateEmailSpec] Continuing to attempt {n+1}
```

### Success
```
[generateEmailSpec] ✅ SUCCESS on attempt {n}! Enhancing theme...
[generateEmailSpec] Returning spec with {n} warnings
```

### Exception Handling
```
[generateEmailSpec] Exception caught on attempt {n}: {error}
[generateEmailSpec] LLMError thrown, propagating up
[generateEmailSpec] Timeout error detected
[generateEmailSpec] Max attempts reached with error
[generateEmailSpec] Request failed, will retry. Error: {message}
```

## Debugging Infinite Loops

When generation runs infinitely, check the console output for:

### 1. **Stuck in LLM Call**
If you see:
```
[generateEmailSpec] Calling LLM with temperature X
```
But never see "LLM response received", the LLM API call is hanging.

**Diagnosis:** Network timeout or OpenAI API issue
**Solution:** Check network, API key, or increase timeout

### 2. **Repeated JSON Parse Errors**
If you see multiple:
```
[generateEmailSpec] JSON parse error on attempt X
```

**Diagnosis:** System prompt may have JSON syntax issues
**Solution:** Check the JSON template in `buildSystemPrompt()`

### 3. **Same Validation Error Repeating**
If you see:
```
[generateEmailSpec] Zod validation failed on attempt 1
  1. sections.4.layout.variant: Invalid input
[generateEmailSpec] Error signature added to history
[generateEmailSpec] Zod validation failed on attempt 2
  1. sections.4.layout.variant: Invalid input
[generateEmailSpec] Repeated error detected: sections.4.layout.variant: Invalid input
```

**Diagnosis:** LLM cannot fix the error based on repair instructions
**Solution:** Improve repair instructions or fix system prompt template

### 4. **Loop Never Exits**
If attempts keep incrementing beyond 3:
```
[generateEmailSpec] Starting attempt 4/3  <-- SHOULD NOT HAPPEN
```

**Diagnosis:** Loop logic broken
**Solution:** Check for missing `continue`, `return`, or `throw` statements

### 5. **Stuck in Structural Validation**
If you see:
```
[generateEmailSpec] Running structural validation
```
But never see "complete", the validator may have an infinite loop.

**Diagnosis:** Bug in `validateEmailSpecStructure()`
**Solution:** Check validator implementation

## How to Use

1. **Run the generation** and watch console output
2. **Identify the last log message** - this shows where it got stuck
3. **Check the pattern** - is it repeating? Does it stop at a specific step?
4. **Match to diagnosis** above and apply the solution

## Example: Successful Generation

```
[generateEmailSpec] ========== STARTING EMAIL SPEC GENERATION ==========
[generateEmailSpec] Brand: Test Brand
[generateEmailSpec] Intent type: sale
[generateEmailSpec] Plan has 4 sections
[generateEmailSpec] Normalizing schemas...
[generateEmailSpec] Schemas normalized successfully
[generateEmailSpec] Starting attempt 1/3
[generateEmailSpec] Building prompts for attempt 1
[generateEmailSpec] Calling LLM with temperature 0.7
[generateEmailSpec] LLM response received, attempt 1
[generateEmailSpec] Parsing JSON response (length: 3542)
[generateEmailSpec] JSON parsed successfully
[generateEmailSpec] Validating with Zod schema
[generateEmailSpec] Zod validation passed
[generateEmailSpec] Running structural validation
[generateEmailSpec] Structural validation complete: 0 errors, 2 warnings
[generateEmailSpec] ✅ SUCCESS on attempt 1! Enhancing theme...
[generateEmailSpec] Returning spec with 2 warnings
```

## Removing Debug Logs

To remove debug logs for production:
1. Search for `console.log` in `generateEmailSpec.ts`
2. Replace with conditional logging: `if (process.env.DEBUG_LLM) console.log(...)`
3. Or remove entirely after debugging is complete
