# Vercel Deployment Guide

This application is configured to work seamlessly on Vercel's serverless platform, including full support for Playwright web scraping.

## Overview

The web scraping functionality has been optimized for Vercel deployment using `@sparticuz/chromium`, a lightweight Chromium build designed for serverless environments. The application automatically detects whether it's running locally or on Vercel and uses the appropriate browser binary.

## Key Features

- **Automatic Environment Detection**: The browser module automatically detects Vercel/serverless environments and uses the appropriate Chromium binary
- **Memory Optimization**: Resource blocking (fonts, videos) in serverless mode to stay within Vercel's memory limits
- **Persistent Browser Instance**: Browser instance is cached and reused across requests to reduce cold start times
- **Periodic Cleanup**: Browser automatically restarts every 10 minutes to prevent memory leaks
- **Page-Level Cleanup**: Individual pages are closed after scraping to free memory while keeping the browser warm

## Architecture

### Browser Module (`lib/scraper/browser.ts`)

The browser module handles browser lifecycle management with environment-aware configuration:

```typescript
// Automatically detects environment
if (isVercelEnvironment()) {
  // Uses @sparticuz/chromium for serverless
} else {
  // Uses local Playwright for development
}
```

### Configuration Files

#### `vercel.json`

```json
{
  "functions": {
    "app/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  },
  "build": {
    "env": {
      "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1"
    }
  }
}
```

- **Memory**: 1024MB (1GB) - sufficient for Playwright scraping
- **Max Duration**: 60 seconds - allows time for complex scraping operations
- **PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD**: Prevents downloading unused Playwright browsers
- **Applies to**: All API routes under `app/api/`

#### `.npmrc` (Required for pnpm)

```
# Configure pnpm to work with @sparticuz/chromium
node-linker=hoisted
public-hoist-pattern[]=@sparticuz/chromium
shamefully-hoist=true
```

> **Why**: Vercel uses pnpm by default. This configures pnpm to create a flat node_modules structure.

#### `next.config.ts` (Critical for binary files!)

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mjml", "@sparticuz/chromium", "playwright-core"],
  output: "standalone",
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('@sparticuz/chromium');
    }
    return config;
  },
};

export default nextConfig;
```

> **Critical**: The `output: "standalone"` and webpack externals configuration ensure that @sparticuz/chromium's binary files are included in the deployment and not bundled by webpack. Without this, you'll get "brotli files not found" errors.

## Dependencies

The following packages are installed for Vercel compatibility:

- `@sparticuz/chromium` - Lightweight Chromium binary optimized for AWS Lambda/Vercel
- `playwright-core` - Playwright without browser binaries (uses external Chromium)
- `playwright` - Full Playwright for local development

## Local Development

When running locally, the application uses the standard Playwright Chromium binary:

```bash
pnpm dev
```

The browser module automatically detects it's not in a serverless environment and uses local Chromium.

## Deployment to Vercel

### Prerequisites

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

### Deploy

#### Preview Deployment

Test your deployment in preview mode first:

```bash
vercel
```

This will:
- Deploy to a preview URL
- Allow you to test the scraping functionality
- Show any errors before production deployment

#### Production Deployment

Once preview works correctly:

```bash
vercel --prod
```

### Testing the Deployed Scraper

Test the brand scraping endpoint:

```bash
curl -X POST https://your-app.vercel.app/api/brand \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## Performance Optimizations

### 1. Resource Blocking

In serverless environments, the scraper automatically blocks heavy resources:
- Fonts (not needed for scraping)
- Videos and audio
- Keeps images (needed for brand/product extraction)

### 2. Browser Persistence

The browser instance is cached and reused across multiple requests:
- Reduces cold start time from 5-10 seconds to <1 second
- Saves memory by avoiding repeated browser launches
- Automatically restarts every 10 minutes to prevent memory leaks

### 3. Page-Level Cleanup

After each scraping operation, only the page is closed (not the browser):
```typescript
await page.close(); // Close page to free memory
// Browser stays warm for next request
```

## Memory Management

### Current Configuration
- **Memory Limit**: 1024MB (Vercel Hobby plan)
- **Typical Usage**: 300-500MB per scraping operation
- **Safety Margin**: ~50% for memory spikes

### Monitoring Memory Usage

Monitor memory in Vercel dashboard:
1. Go to your project → **Observability** tab
2. Click **Build Diagnostics**
3. Check **Deployments** section for memory consumption

### If You Hit Memory Limits

If you encounter "Memory limit exceeded" errors:

1. **Upgrade Vercel Plan**: Pro plans get up to 3GB memory
2. **Block More Resources**: Add CSS blocking in `browser.ts`:
```typescript
if (resourceType === "stylesheet") {
  route.abort();
}
```
3. **Reduce Viewport Size**: Smaller viewport = less memory
4. **Limit Concurrent Scraping**: Process requests sequentially

## Timeout Management

### Current Configuration
- **Max Duration**: 60 seconds (Vercel Hobby plan)
- **Typical Scraping Time**: 5-15 seconds
- **Safety Margin**: 3-4x average time

### If You Hit Timeout Limits

If scraping operations timeout:

1. **Upgrade Vercel Plan**: Pro plans get up to 300 seconds
2. **Optimize Scraping Logic**: Reduce pages crawled
3. **Increase Timeout** in `vercel.json`:
```json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 300  // Pro plan maximum
    }
  }
}
```

## Common Issues & Solutions

### Issue: "No browser binary found" or "Executable doesn't exist"

**Cause**: Vercel is trying to use local Playwright instead of `@sparticuz/chromium`

**Solution**:
1. Ensure `@sparticuz/chromium` and `playwright-core` are installed:
```bash
pnpm install @sparticuz/chromium@latest playwright-core@latest
```

2. Verify `vercel.json` includes the build environment variable:
```json
{
  "build": {
    "env": {
      "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1"
    }
  }
}
```

3. Redeploy:
```bash
vercel --prod
```

### Issue: "Memory limit exceeded"

**Cause**: Browser or page not being cleaned up properly

**Solution**:
- Ensure `page.close()` is called after each scraping operation
- Verify `closeBrowser()` is periodically called
- Check for memory leaks in Vercel dashboard

### Issue: Timeout errors

**Cause**: Scraping takes too long for current limit

**Solution**:
- Increase `maxDuration` in `vercel.json`
- Optimize scraping to load fewer pages
- Block more resources to speed up page loads

### Issue: Cold starts are slow

**Cause**: Browser instance not being reused

**Solution**:
- The current implementation should already cache the browser
- Verify `browserInstance` is not being set to `null` prematurely
- Check logs for "Browser instance created" messages

## Environment Variables

If you need to configure the browser differently for Vercel:

```env
# .env.production (Vercel)
VERCEL=1
```

The application automatically detects this and uses `@sparticuz/chromium`.

## Best Practices

1. **Always close pages**: Call `page.close()` after scraping to free memory
2. **Don't close browser**: Keep browser instance warm for next request
3. **Monitor memory**: Check Vercel dashboard regularly for memory spikes
4. **Test preview first**: Always test in preview before deploying to production
5. **Set reasonable limits**: Don't scrape too many pages in a single request
6. **Use caching**: Cache scraping results when possible to avoid repeated scraping

## Vercel Plan Recommendations

### Hobby (Free) Plan
- **Memory**: 1024MB
- **Timeout**: 60 seconds
- **Suitable for**: Light scraping (1-3 pages per request)

### Pro Plan
- **Memory**: 3008MB
- **Timeout**: 300 seconds
- **Suitable for**: Heavy scraping (5-10 pages per request)

### Enterprise Plan
- **Memory**: Configurable
- **Timeout**: Configurable
- **Suitable for**: Large-scale scraping operations

## Additional Resources

- [Vercel Function Configuration](https://vercel.com/docs/functions/configuration)
- [@sparticuz/chromium Documentation](https://github.com/Sparticuz/chromium)
- [Playwright Core API](https://playwright.dev/docs/api/class-playwright)

## Support

For issues or questions about Vercel deployment:
1. Check Vercel deployment logs in the dashboard
2. Review browser logs in Vercel function logs
3. Test locally with `VERCEL=1` environment variable to simulate serverless mode
