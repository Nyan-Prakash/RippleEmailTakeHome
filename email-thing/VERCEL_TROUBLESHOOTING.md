# Vercel Deployment Troubleshooting

## Common Errors

### Error 1: "Executable doesn't exist at /home/sbx_user1051/.cache/ms-playwright/..."

#### Symptoms
```
[ScraperError] Unexpected error: Error: browserType.launch: 
Executable doesn't exist at /home/sbx_user1051/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell

╔═════════════════════════════════════════════════════════════════════════╗
║ Looks like Playwright Test or Playwright was just installed or updated. ║
║ Please run the following command to download new browsers:              ║
║                                                                         ║
║     npx playwright install                                              ║
╚═════════════════════════════════════════════════════════════════════════╝
```

#### Root Cause
Vercel is trying to use the local Playwright browser binary instead of `@sparticuz/chromium`. This happens because:
1. The `playwright` package is being loaded in the serverless environment
2. Environment detection isn't working correctly
3. Playwright browsers aren't being skipped during Vercel build

---

### Error 2: "The input directory ... does not exist. Please provide the location of the brotli files."

#### Symptoms
```
[Browser] Launching browser in Vercel serverless mode...
[ScraperError] Unexpected error: Error: The input directory "/var/task/email-thing/node_modules/.pnpm/@sparticuz+chromium@143.0.0/node_modules/@sparticuz/chromium/bin" does not exist. Please provide the location of the brotli files.
```

#### Root Cause
The @sparticuz/chromium binary files aren't being included in the Vercel deployment bundle. This happens when:
1. Vercel's bundler excludes the binary files from node_modules
2. The `includeFiles` configuration is missing from vercel.json
3. The package structure doesn't match Vercel's expectations

#### Solution

**The issue is that Vercel uses pnpm by default, which creates a different node_modules structure that @sparticuz/chromium can't navigate.**

**Fix: Configure pnpm to hoist @sparticuz/chromium**

The issue is that pnpm's default structure hides packages in a `.pnpm` directory. We need to hoist @sparticuz/chromium to the root.

**Step 1: Create/update `.npmrc` file:**
```
# Configure pnpm to work with @sparticuz/chromium
node-linker=hoisted
public-hoist-pattern[]=@sparticuz/chromium
shamefully-hoist=true
```

**Step 2: Ensure `vercel.json` is minimal:**
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

**What this does:**
- `node-linker=hoisted` - Creates a flat node_modules structure
- `public-hoist-pattern[]` - Specifically hoists @sparticuz/chromium
- `shamefully-hoist=true` - Ensures all dependencies are accessible

Then redeploy:
```bash
vercel --prod --force
```

---

## General Solutions

### Solution

#### Step 1: Verify Dependencies
Check your `package.json` includes both packages:
```json
{
  "dependencies": {
    "@sparticuz/chromium": "^143.0.0",
    "playwright": "^1.57.0",
    "playwright-core": "^1.57.0"
  }
}
```

#### Step 2: Update vercel.json
Ensure your `vercel.json` forces npm installation (not pnpm):
```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "functions": {
    "app/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  },
  "build": {
    "env": {
      "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1",
      "NPM_CONFIG_LEGACY_PEER_DEPS": "true"
    }
  }
}
```

**Critical**: The `installCommand` forces npm instead of pnpm. This is essential because @sparticuz/chromium requires npm's flat node_modules structure to locate its binary files. pnpm's `.pnpm` directory structure breaks the package's file resolution.

#### Step 3: Create .vercelignore
Add a `.vercelignore` file to exclude local browser binaries:
```
# Ignore Playwright local browser binaries
node_modules/playwright/.local-browsers
.cache/ms-playwright

# Ignore test files
**/__tests__/**
*.test.ts
*.test.tsx
```

#### Step 4: Verify Browser Module
Check `lib/scraper/browser.ts` uses dynamic imports correctly:

```typescript
if (isVercel) {
  // Import chromium binary and playwright-core
  const chromiumBinary = await import("@sparticuz/chromium");
  const { chromium } = await import("playwright-core");
  
  const executablePath = await chromiumBinary.default.executablePath();
  
  browserInstance = await chromium.launch({
    args: chromiumBinary.default.args,
    executablePath: executablePath,
    headless: true,
  });
}
```

#### Step 5: Redeploy
```bash
# Clear build cache and redeploy
vercel --prod --force
```

### Verification

After redeploying, check the Vercel function logs. You should see:
```
[Browser] Launching browser in Vercel serverless mode...
[Browser] Browser instance created successfully
```

Instead of:
```
[Browser] Launching browser in local development mode...
```

### Testing Locally with Serverless Mode

You can simulate Vercel's environment locally:

```bash
# Set environment variable
export VERCEL=1

# Run your API
pnpm dev

# Or test scraper directly
pnpm scraper:dev -- https://example.com
```

You should see:
```
[Browser] Launching browser in Vercel serverless mode...
```

### Additional Checks

1. **Check Vercel Environment Variables**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Verify `VERCEL` is set to `1` (it should be automatic)

2. **Check Build Logs**:
   - Go to Vercel Dashboard → Your Project → Deployments → Latest Deployment
   - Click on "Building" to see build logs
   - Verify you see: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`

3. **Check Function Size**:
   - Large function sizes (>250MB) may indicate Playwright browsers are being bundled
   - Properly configured, your function should be ~70-80MB

### Still Not Working?

If you're still seeing this error after following all steps:

1. **Force Clean Build**:
```bash
# Remove node_modules and lock file
rm -rf node_modules pnpm-lock.yaml
pnpm install
vercel --prod --force
```

2. **Check Vercel Logs for Environment Detection**:
```bash
vercel logs <your-deployment-url>
```
Look for the browser initialization logs.

3. **Contact Support**:
   - Include your Vercel deployment URL
   - Include browser initialization logs
   - Include your `vercel.json` and `package.json`

## Quick Fix Checklist

- [ ] `@sparticuz/chromium` and `playwright-core` installed
- [ ] `vercel.json` includes `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
- [ ] `.vercelignore` excludes Playwright browsers
- [ ] `lib/scraper/browser.ts` uses dynamic imports
- [ ] Redeployed with `vercel --prod --force`
- [ ] Checked Vercel logs show "Vercel serverless mode"
- [ ] Function size is reasonable (~70-80MB)

If all boxes are checked and it still doesn't work, the issue may be with Vercel's build process or environment configuration.
