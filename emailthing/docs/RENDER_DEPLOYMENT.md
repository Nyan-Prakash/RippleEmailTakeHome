# Deploying to Render.com with Playwright Support

This guide will help you deploy your Next.js application with Playwright to Render.com.

## Prerequisites

1. A Render.com account (free tier works)
2. Your project pushed to GitHub
3. Environment variables ready (like `OPENAI_API_KEY`)

## Step-by-Step Deployment

### 1. Prepare Your Repository

Make sure all the following files are committed to your repository:
- `render.yaml` - Render configuration
- `render-build.sh` - Custom build script with Playwright installation
- Updated `lib/scraper/browser.ts` - Production-ready browser configuration
- Updated `package.json` - Includes `playwright-core`

Commit and push these changes:
```bash
cd /Users/nyanprakash/Desktop/ihate/RippleEmailTakeHome/emailthing
git add .
git commit -m "feat: Add Render.com deployment configuration with Playwright support"
git push origin main
```

### 2. Create a New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select the repository: `RippleEmailTakeHome`

### 3. Configure the Service

Render should auto-detect the `render.yaml` file. If not, configure manually:

**Basic Settings:**
- **Name**: `emailthing` (or your preferred name)
- **Region**: Choose closest to your users (Oregon recommended)
- **Branch**: `main`
- **Root Directory**: `emailthing` (if your app is in a subdirectory)

**Build & Deploy:**
- **Build Command**: `./render-build.sh`
- **Start Command**: `pnpm start`

**Instance Type:**
- **Plan**: Select **Starter** or higher (Free tier may not have enough memory for Playwright)
- ⚠️ **Important**: Playwright requires at least 1GB RAM. Free tier (512MB) will likely fail.

### 4. Add Environment Variables

In the Render dashboard, add your environment variables:

1. Click on **"Environment"** tab
2. Add the following:

**Required:**
```
OPENAI_API_KEY=your-api-key-here
NODE_ENV=production
```

**Playwright Configuration (auto-configured via render.yaml):**
```
PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/.cache/ms-playwright
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0
RENDER=true
```

**Optional:**
```
PORT=10000  (Render auto-assigns this)
```

### 5. Deploy

1. Click **"Create Web Service"**
2. Render will start building your application
3. Watch the build logs for any errors

**Build Process:**
- Install dependencies with pnpm
- Install Playwright Chromium browser with system dependencies
- Build Next.js application
- Start the server

### 6. Verify Deployment

Once deployed, test your endpoints:

```bash
# Health check
curl https://your-app.onrender.com/api/health

# Test brand scraping (replace with your URL)
curl -X POST https://your-app.onrender.com/api/brand \
  -H "Content-Type: application/json" \
  -d '{"url": "https://allbirds.com"}'
```

## Troubleshooting

### Issue: "Browser not found" or "Executable doesn't exist"

**Cause**: Playwright browsers didn't install correctly

**Solution**:
1. Check build logs for Playwright installation errors
2. Ensure build script has execute permissions: `chmod +x render-build.sh`
3. Verify `render-build.sh` includes: `npx playwright install --with-deps chromium`
4. Try manual redeploy

### Issue: "Out of memory" or crashes

**Cause**: Not enough RAM for Playwright

**Solutions**:
1. Upgrade to **Starter Plan** or higher (minimum 1GB RAM)
2. Verify browser args include memory optimization flags (already configured)
3. Ensure `closePage()` is called after scraping to free memory
4. Check for memory leaks in your scraping code

### Issue: Build fails with "playwright: command not found"

**Cause**: Playwright not properly installed

**Solution**:
1. Ensure `playwright` is in `dependencies` (not `devDependencies`)
2. Check `render-build.sh` runs `npx playwright install --with-deps chromium`
3. Verify build logs show Playwright installation step

### Issue: Slow or timing out

**Cause**: Playwright startup can be slow on first run

**Solutions**:
1. Increase timeouts in your scraping code (already set to 30s)
2. Use persistent browser instances (already implemented)
3. Consider caching scraping results
4. Upgrade to a more powerful instance

### Issue: Fonts not rendering correctly

**Cause**: Missing system fonts

**Solution**: The `--with-deps` flag in the build script installs system dependencies including fonts. If issues persist:
1. Check build logs for font installation warnings
2. Ensure `npx playwright install --with-deps chromium` runs successfully

## Performance Optimization

### Memory Management
- Browser instance is reused across requests (singleton pattern)
- Pages are closed after use via `closePage(page)`
- Browser restarts every 10 minutes to prevent memory leaks
- Resource blocking (videos, audio) reduces memory usage

### Scaling
- **Starter Plan** (1GB): Good for ~5-10 concurrent scrapes
- **Standard Plan** (2GB): Good for ~10-20 concurrent scrapes
- Consider implementing request queuing for high traffic

### Monitoring
1. Check Render metrics for memory usage
2. Monitor response times in Render dashboard
3. Set up alerts for failures
4. Use logging to track scraping performance

## Architecture Notes

### Browser Configuration
- **Development**: Uses local Playwright installation
- **Production/Render**: Uses optimized args for memory efficiency
- **Headless**: Always runs in headless mode
- **Args**: Configured for containerized environments

### File Structure
```
emailthing/
├── render.yaml              # Render configuration
├── render-build.sh          # Custom build script
├── lib/scraper/browser.ts   # Environment-aware browser management
└── package.json             # Dependencies including playwright
```

## Cost Considerations

**Free Tier**:
- ❌ Not recommended - 512MB RAM insufficient for Playwright
- Will likely crash or timeout

**Starter Plan ($7/month)**:
- ✅ Recommended minimum - 1GB RAM
- Good for development and low-traffic production
- ~10 concurrent scrapes

**Standard Plan ($25/month)**:
- ✅ Better for production - 2GB RAM
- Handles more concurrent requests
- Better performance

## Maintenance

### Updating Dependencies
```bash
pnpm update playwright
git add package.json pnpm-lock.yaml
git commit -m "chore: Update Playwright"
git push
```

Render will auto-deploy on push (if enabled).

### Manual Redeploy
1. Go to Render dashboard
2. Click on your service
3. Click **"Manual Deploy"** → **"Clear build cache & deploy"**

### Logs
Access logs in Render dashboard:
1. Click on your service
2. Go to **"Logs"** tab
3. Filter by time or search for errors

## Environment Variables Reference

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `production` | Enables production optimizations |
| `RENDER` | `true` | Detects Render environment |
| `PLAYWRIGHT_BROWSERS_PATH` | `/opt/render/project/.cache/ms-playwright` | Browser cache location |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | `0` | Ensures browsers are installed |
| `OPENAI_API_KEY` | Your API key | Required for AI features |
| `NODE_VERSION` | `20` | Node.js version |
| `PNPM_VERSION` | `9` | Package manager version |

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Playwright Documentation](https://playwright.dev)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)

## Support

If you encounter issues:
1. Check the build logs in Render dashboard
2. Review the troubleshooting section above
3. Verify all environment variables are set correctly
4. Ensure you're using Starter plan or higher (minimum 1GB RAM)

## Security Notes

⚠️ **Important**: Your `.env.local` file contains sensitive API keys. Make sure:
1. `.env.local` is in `.gitignore`
2. Never commit API keys to Git
3. Use Render's environment variables for secrets
4. Rotate keys if accidentally exposed
