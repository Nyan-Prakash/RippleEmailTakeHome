# 🚨 IMMEDIATE FIX FOR YOUR RENDER DEPLOYMENT

Your deployment is failing because Render is using `yarn` instead of `pnpm`, and the build isn't completing.

## Quick Fix Steps (Do This Now)

### 1. Go to Your Render Dashboard
Visit: https://dashboard.render.com/

### 2. Find Your Service
Click on `emailthing` (or whatever you named it)

### 3. Go to Settings
Click on **"Settings"** in the left sidebar

### 4. Update Build Command
Scroll to **"Build Command"** and replace it with:
```bash
npm install -g pnpm@9 && pnpm install && pnpm exec playwright install --with-deps chromium && pnpm build
```

### 5. Update Start Command
Make sure **"Start Command"** is:
```bash
pnpm start
```

### 6. Verify Environment Variables
Go to **"Environment"** tab and make sure you have:
```
OPENAI_API_KEY=<your-key>
NODE_ENV=production
RENDER=true
```

### 7. Save and Redeploy
1. Scroll to bottom and click **"Save Changes"**
2. Go to **"Manual Deploy"** section
3. Click **"Clear build cache & deploy"**

## What This Does

The new build command:
1. ✅ Installs pnpm globally (so Render uses it instead of yarn)
2. ✅ Installs your project dependencies with pnpm
3. ✅ Installs Playwright Chromium browser with system dependencies
4. ✅ Builds your Next.js application

## Expected Build Log Output

You should see:
```
==> Installing pnpm globally...
==> Installing project dependencies...
==> Installing Playwright Chromium...
==> Building Next.js application...
   ✓ Creating an optimized production build
   ✓ Compiled successfully
==> Build completed successfully!
```

## After Successful Build

Test your deployment:
```bash
# Health check
curl https://rippleemailtakehome.onrender.com/api/health

# Brand scraping test
curl -X POST https://rippleemailtakehome.onrender.com/api/brand \
  -H "Content-Type: application/json" \
  -d '{"url": "https://allbirds.com"}'
```

## If It Still Fails

### Check 1: Plan Type
- Go to **Settings** → **Instance Type**
- Must be **Starter** or higher (Free tier = 512MB, not enough)
- Upgrade if needed

### Check 2: Build Logs
Look for specific error messages:
- "Out of memory" = Need to upgrade plan
- "playwright not found" = Build command didn't run correctly
- "Permission denied" = File permissions issue (shouldn't happen on Render)

### Check 3: Root Directory
If your app is in the `emailthing/` subfolder of your repo:
- Go to **Settings** → **Root Directory**
- Set to: `emailthing`

## Alternative: Delete and Recreate

If issues persist:
1. Delete the current service
2. Create a new one
3. Use the `render.yaml` file (updated in your repo)
4. Render should auto-configure everything

## Need More Help?

The updated files in your repo:
- `render.yaml` - Correct configuration
- `render-build.sh` - Alternative build script
- `RENDER_MANUAL_CONFIG.md` - Step-by-step manual setup
- `RENDER_DEPLOYMENT.md` - Full deployment guide

---

**TL;DR**: Update the build command in Render dashboard settings, then redeploy with cleared cache.
