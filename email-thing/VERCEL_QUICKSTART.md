# Vercel Deployment - Quick Reference

## 🚀 Quick Deploy

```bash
# Preview deployment (test first)
vercel

# Production deployment
vercel --prod
```

## 🧪 Test Locally with Serverless Mode

```bash
# Set environment variable to simulate Vercel
export VERCEL=1

# Run development server
pnpm dev

# Or test scraper directly
pnpm scraper:dev -- https://example.com
```

## 📊 Current Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Memory | 1024MB (1GB) | Sufficient for most scraping |
| Timeout | 60 seconds | Covers 95% of scraping operations |
| Plan | Hobby (Free) | Upgrade to Pro for heavier usage |

## 🔍 Verify Deployment

After deploying, test the brand scraping endpoint:

```bash
# Replace with your actual Vercel URL
curl -X POST https://your-app.vercel.app/api/brand \
  -H "Content-Type: application/json" \
  -d '{"url": "https://allbirds.com"}'
```

## ⚠️ Common Issues

### Issue: "Memory limit exceeded"
```bash
# Solution: Upgrade to Pro plan or optimize memory usage
# Check memory in Vercel Dashboard → Observability → Build Diagnostics
```

### Issue: "Timeout error"
```json
// Solution: Increase timeout in vercel.json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 300  // Requires Pro plan
    }
  }
}
```

### Issue: "No browser binary found" or "Executable doesn't exist"
```bash
# Solution: Ensure proper configuration and force redeploy
pnpm install @sparticuz/chromium@latest playwright-core@latest

# Verify vercel.json has PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# Then force redeploy
vercel --prod --force
```

See [VERCEL_TROUBLESHOOTING.md](./VERCEL_TROUBLESHOOTING.md) for detailed debugging steps.

## 📈 Monitoring

Monitor your deployment in the Vercel Dashboard:

1. **Logs**: View real-time function logs
2. **Analytics**: Track request patterns
3. **Observability**: Monitor memory/CPU usage
4. **Build Diagnostics**: Check build size and memory

## 🎯 Best Practices

✅ **DO:**
- Always test in preview mode first (`vercel`)
- Close pages after scraping (`page.close()`)
- Monitor memory usage in dashboard
- Keep browser instance warm (don't close browser)

❌ **DON'T:**
- Close browser after each request (kills performance)
- Scrape 10+ pages in a single request
- Ignore timeout/memory warnings
- Skip preview deployment testing

## 📚 Full Documentation

For detailed information, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

## 🆘 Getting Help

1. Check Vercel function logs in dashboard
2. Review browser initialization logs
3. Test locally with `VERCEL=1` environment variable
4. Check the full deployment guide for troubleshooting steps
