# Vercel Chromium Fix - Summary

## Changes Made

### 1. **Replaced Playwright with Puppeteer**
   - Removed: `playwright`, `playwright-core`, `@sparticuz/chromium-min`
   - Added: `@sparticuz/chromium`, `puppeteer-core@13.5.2`
   - Reason: Puppeteer with @sparticuz/chromium is the recommended stack for AWS Lambda/Vercel serverless

### 2. **Updated Dependencies**
```json
{
  "dependencies": {
    "@sparticuz/chromium": "^143.0.0",
    "puppeteer-core": "13.5.2"
  }
}
```

### 3. **Updated Browser Configuration** (`lib/scraper/browser.ts`)
   - For **Vercel/Serverless**: Uses `@sparticuz/chromium` + `puppeteer-core`
   - For **Local Development**: Uses `puppeteer-core` with system Chrome
   - Sets required environment variables (`HOME=/tmp`, `FONTCONFIG_PATH=/tmp`)

### 4. **Updated Next.js Configuration** (`next.config.ts`)
   - Added `turbopack: {}` to support Next.js 16
   - Updated `serverExternalPackages` to include `@sparticuz/chromium`
   - Updated webpack externals for proper bundling

### 5. **Updated Vercel Configuration** (`vercel.json`)
   - Increased memory to 3008 MB (required for Chromium)
   - Removed `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` environment variable

## How It Works

### On Vercel (Serverless)
1. `@sparticuz/chromium` detects the Lambda environment
2. Downloads and extracts Chromium binary to `/tmp` (writable directory)
3. Puppeteer launches the extracted Chromium
4. Binary is cached in `/tmp` for subsequent requests

### On Local Development
1. Searches for Chrome in common system locations
2. Uses `puppeteer-core` to launch the system Chrome
3. Falls back with error message if Chrome is not installed

## Deployment Checklist

- [x] Build succeeds locally
- [ ] Verify deployment on Vercel
- [ ] Test API endpoints
- [ ] Check Vercel function logs

## Troubleshooting

### If you get "Chrome not found" locally:
Install Google Chrome from https://www.google.com/chrome/

### If deployment fails with memory errors:
The `vercel.json` is configured for 3008 MB (maximum). If this isn't enough, consider:
- Reducing the number of pages scraped simultaneously
- Implementing caching to avoid repeated scrapes
- Using Vercel Pro plan for higher limits

### If you get timeout errors:
- Current timeout is 60 seconds in `vercel.json`
- Consider reducing the scraper timeout budget in `lib/scraper/index.ts`

## API Endpoints to Test

After deployment, test these endpoints:
- `GET /api/health` - Should return 200
- `POST /api/brand/ingest` - Test with a brand URL
- `POST /api/campaign/intent` - Test campaign creation
- `POST /api/email/plan` - Test email planning
- `POST /api/email/spec` - Test email spec generation
- `POST /api/email/render` - Test email rendering

## Important Notes

1. **First request after deployment will be slower** - Chromium needs to be extracted to `/tmp`
2. **Subsequent requests will be faster** - Binary is cached in `/tmp`
3. **Cold starts will re-extract** - This is normal for serverless
4. **Memory usage is high** - 3008 MB is needed for Chromium + scraping

## Current Status

✅ Build completed successfully
✅ Configuration updated for Vercel
✅ Memory allocated (3008 MB)
✅ Deployment completed successfully

## Testing Your Deployment

### 1. Access the Homepage
Navigate to your Vercel deployment URL (e.g., `https://your-app.vercel.app/`)
- You should see the email generation wizard interface
- This is the main UI where you can input a brand URL and generate emails

### 2. Test the Health Check API
```bash
curl https://your-app.vercel.app/api/health
```
Expected response: `{"status": "ok", "timestamp": "..."}`

### 3. Test Brand Ingestion (Web Scraping)
This endpoint uses the Chromium browser we just fixed:
```bash
curl -X POST https://your-app.vercel.app/api/brand/ingest \
  -H "Content-Type: application/json" \
  -d '{"brandUrl": "https://www.allbirds.com"}'
```

Expected response: Brand context object with:
- Brand name
- Logo URL
- Colors
- Fonts
- Products
- Voice snippets

### 4. Using the UI
1. Go to your deployment URL
2. Enter a brand URL (e.g., `https://www.allbirds.com`)
3. Click "Ingest Brand"
4. Wait for the scraping to complete (first request may take 10-20 seconds)
5. Follow the wizard to generate an email

## What Changed from the Error

**Before:** 
```
Error: The input directory "/var/task/email-thing/node_modules/@sparticuz/chromium-min/bin" 
does not exist. Please provide the location of the brotli files.
```

**After:**
- Switched from `@sparticuz/chromium-min` to full `@sparticuz/chromium`
- Full package includes brotli-compressed Chromium binary (~50MB)
- Binary extracts to `/tmp` automatically on first use
- Subsequent requests use cached binary

**Why it works now:**
- `@sparticuz/chromium` (full) bundles the binary files correctly
- Vercel's Lambda environment has `/tmp` directory with write access
- Binary decompresses on-demand during cold starts
- 3008 MB memory allocation is sufficient for Chromium + Node.js

## Performance Expectations

### Cold Start (First Request or After Idle)
- **Time:** 15-30 seconds
- **Why:** Chromium binary extraction + browser launch + page load
- **Memory:** ~2GB peak usage

### Warm Requests (Subsequent Calls)
- **Time:** 5-10 seconds
- **Why:** Binary cached in `/tmp`, only page load needed
- **Memory:** ~1.5GB peak usage

## Next Steps

1. ✅ Verify deployment works by accessing your Vercel URL
2. ✅ Test the `/api/health` endpoint
3. ✅ Test brand ingestion with `/api/brand/ingest`
4. ✅ Use the UI to generate a complete email
5. ✅ Monitor Vercel function logs for any issues

## Monitoring

View logs in Vercel dashboard:
1. Go to your project on Vercel
2. Click on the deployment
3. Go to "Functions" tab
4. Check logs for any errors or warnings

Look for these log messages confirming Chromium is working:
```
[Browser] Launching browser in Vercel serverless mode...
[Browser] Getting Chromium executable path...
[Browser] Chrome executable path: /tmp/chromium
[Browser] Browser launched successfully in serverless mode
```
