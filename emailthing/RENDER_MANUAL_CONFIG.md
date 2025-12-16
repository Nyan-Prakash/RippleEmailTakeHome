# Render Deployment - Manual Configuration

If the `render.yaml` file isn't being detected, configure your service manually in the Render dashboard with these settings:

## Build & Deploy Settings

**Root Directory**: Leave blank (or set to `emailthing` if this is in a subdirectory)

**Build Command**:
```bash
npm install -g pnpm@9 && pnpm install && pnpm exec playwright install --with-deps chromium && pnpm build
```

**Start Command**:
```bash
pnpm start
```

## Environment Variables

Add these in the Render dashboard under **Environment**:

### Required
```
OPENAI_API_KEY=<your-actual-openai-key>
NODE_ENV=production
RENDER=true
```

### Optional (for optimization)
```
PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/.cache/ms-playwright
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0
```

## Plan & Region

- **Plan**: **Starter** or higher (minimum 1GB RAM required for Playwright)
- **Region**: Choose closest to your users (Oregon recommended)
- **Node Version**: 20 (auto-detected)

## Important Notes

1. **Build Time**: First build takes 5-10 minutes (installing Chromium)
2. **Memory**: Free tier (512MB) won't work - need at least 1GB
3. **pnpm**: The build command installs pnpm globally first
4. **Playwright**: Installs with `--with-deps` flag for system dependencies

## After Configuration

1. Click **"Create Web Service"** or **"Manual Deploy"**
2. Watch build logs for errors
3. Look for "Build completed successfully!" message
4. Test with: `curl https://your-app.onrender.com/api/health`

## Troubleshooting

### If build still fails:
1. Check if build logs show all commands running
2. Verify pnpm installation succeeded
3. Ensure Playwright installation completed
4. Check that Next.js build created `.next` directory

### If "yarn" appears in logs:
The build command is overriding the default. Render should use pnpm as specified.
