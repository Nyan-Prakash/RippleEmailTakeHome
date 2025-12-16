# Quick Render Deployment Checklist

## ✅ Pre-Deployment Checklist

1. [ ] All changes committed to Git
2. [ ] `.env.local` NOT committed (check `.gitignore`)
3. [ ] `render-build.sh` has execute permissions
4. [ ] `playwright-core` added to dependencies
5. [ ] Repository pushed to GitHub

## 🚀 Deployment Steps

### 1. Commit and Push
```bash
cd /Users/nyanprakash/Desktop/ihate/RippleEmailTakeHome/emailthing
git add .
git commit -m "feat: Add Render deployment with Playwright"
git push origin main
```

### 2. Create Render Service
1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub repo: `RippleEmailTakeHome`
4. Render will detect `render.yaml` automatically

### 3. Configure (if needed manually)
- **Root Directory**: `emailthing`
- **Build Command**: `./render-build.sh`
- **Start Command**: `pnpm start`
- **Plan**: **Starter** or higher (minimum 1GB RAM)

### 4. Add Environment Variables
In Render dashboard → Environment tab:
```
OPENAI_API_KEY=<your-actual-key>
```

The other variables are auto-configured via `render.yaml`.

### 5. Deploy
Click **"Create Web Service"** and wait for build.

## ⚠️ Important Notes

- **Free Tier Won't Work**: Playwright needs at least 1GB RAM (Starter plan $7/mo minimum)
- **Build Time**: First build takes 5-10 minutes (installing Chromium)
- **Root Directory**: If your app is in `emailthing/` subfolder, set it in Render

## 🧪 Testing After Deployment

```bash
# Replace YOUR_APP with your Render app name
curl https://YOUR_APP.onrender.com/api/health

# Test scraping
curl -X POST https://YOUR_APP.onrender.com/api/brand \
  -H "Content-Type: application/json" \
  -d '{"url": "https://allbirds.com"}'
```

## 🔧 Troubleshooting

### Build Fails
- Check if `render-build.sh` is executable: `chmod +x render-build.sh`
- Look at build logs in Render dashboard

### "Browser not found"
- Ensure `npx playwright install --with-deps chromium` ran in build logs
- Check `playwright` is in `dependencies` (not devDependencies)

### Out of Memory
- Upgrade to Starter plan or higher
- Browser is optimized but needs minimum 1GB RAM

### Slow Performance
- First request after idle is slower (cold start)
- Consider keeping app warm with a ping service
- Browser instance is reused to improve subsequent requests

## 📊 Monitoring

In Render dashboard:
- **Logs**: Real-time application logs
- **Metrics**: Memory and CPU usage
- **Events**: Deployment history

## 🆘 Need Help?

See detailed guide: `RENDER_DEPLOYMENT.md`
