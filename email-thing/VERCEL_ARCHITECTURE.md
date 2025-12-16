# Vercel Browser Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Start                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Environment Detection                               │
│  isVercelEnvironment() checks:                                   │
│  • process.env.VERCEL === "1"                                   │
│  • process.env.AWS_LAMBDA_FUNCTION_NAME                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ↓                           ↓
┌────────────────────────┐    ┌────────────────────────┐
│  LOCAL DEVELOPMENT     │    │   VERCEL SERVERLESS    │
├────────────────────────┤    ├────────────────────────┤
│ • Uses playwright      │    │ • Uses playwright-core │
│ • Local Chromium       │    │ • @sparticuz/chromium  │
│ • Full features        │    │ • Optimized binary     │
│ • No size limits       │    │ • 66MB compressed      │
└────────────────────────┘    └────────────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Browser Instance (Singleton)                    │
│  • Created once per container                                    │
│  • Reused across requests                                        │
│  • Auto-restarts every 10 minutes                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Request Lifecycle                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
    ┌─────────────────────────────────────────────────┐
    │  1. newPage() - Create page context            │
    │     • Set viewport (1920x1080)                  │
    │     • Set user agent                            │
    │     • Configure timeouts                        │
    │     • Block resources (fonts, videos)           │
    └─────────────────────────────────────────────────┘
                              │
                              ↓
    ┌─────────────────────────────────────────────────┐
    │  2. Navigate & Scrape                          │
    │     • page.goto(url)                            │
    │     • Extract brand data                        │
    │     • Extract products                          │
    │     • Extract colors/fonts                      │
    └─────────────────────────────────────────────────┘
                              │
                              ↓
    ┌─────────────────────────────────────────────────┐
    │  3. closePage() - Free memory                  │
    │     • Close page context                        │
    │     • Keep browser warm                         │
    │     • Ready for next request                    │
    └─────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    Memory Management                             │
└─────────────────────────────────────────────────────────────────┘

Request 1     Request 2     Request 3     ...     Request N
    │             │             │                      │
    ↓             ↓             ↓                      ↓
┌───────┐    ┌───────┐    ┌───────┐              ┌───────┐
│ Page1 │    │ Page2 │    │ Page3 │              │ PageN │
└───┬───┘    └───┬───┘    └───┬───┘              └───┬───┘
    │            │            │                       │
    ↓ close      ↓ close      ↓ close                ↓ close
    
         └────────────┬─────────────────┘
                      │
                      ↓
        ┌─────────────────────────────┐
        │  Browser Instance (Warm)    │
        │  • Lives across requests    │
        │  • Restarts every 10 min    │
        └─────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                   Resource Optimization                          │
└─────────────────────────────────────────────────────────────────┘

                    Page Resources
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ↓                 ↓                 ↓
    ┌──────┐         ┌──────┐         ┌──────┐
    │Images│         │Fonts │         │Videos│
    │ ✓    │         │  ✗   │         │  ✗   │
    │Allow │         │Block │         │Block │
    └──────┘         └──────┘         └──────┘
       │                  │                │
       └─────────┬────────┴────────────────┘
                 │
                 ↓
    Reduced Memory & Bandwidth Usage
         (Critical for Vercel)


┌─────────────────────────────────────────────────────────────────┐
│                   Vercel Configuration                           │
└─────────────────────────────────────────────────────────────────┘

vercel.json
├── functions
│   ├── memory: 1024MB (1GB)
│   ├── maxDuration: 60 seconds
│   └── applies to: app/api/**/*.ts
│
└── routing (automatic)


┌─────────────────────────────────────────────────────────────────┐
│                 Deployment Flow                                  │
└─────────────────────────────────────────────────────────────────┘

Local Development          Preview               Production
       │                      │                       │
       │ vercel              │ vercel --prod         │
       └──────────────────→  └──────────────────→    │
                                                      │
                                                      ↓
                              ┌──────────────────────────────┐
                              │  Vercel Serverless Platform  │
                              ├──────────────────────────────┤
                              │  • Auto-scales               │
                              │  • Global CDN                │
                              │  • 1GB memory per function   │
                              │  • 60s timeout               │
                              └──────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│               Performance Characteristics                        │
└─────────────────────────────────────────────────────────────────┘

Cold Start (First Request)
    Browser Launch: 5-10 seconds
    ↓
    Scraping: 5-15 seconds
    ↓
    Total: 10-25 seconds

Warm Requests (Subsequent)
    Browser Ready: <1 second
    ↓
    Scraping: 5-15 seconds
    ↓
    Total: 5-15 seconds

Memory Profile
    Baseline (Browser): 100-150MB
    ↓
    Active Scraping: +200-350MB
    ↓
    Total: 300-500MB (well within 1GB limit)
```

## Key Takeaways

1. **Single Browser Instance**: One browser per container, reused across all requests
2. **Page-Level Cleanup**: Close pages, not browser, to maintain performance
3. **Automatic Detection**: No code changes needed - works locally and on Vercel
4. **Memory Efficient**: Resource blocking + proper cleanup = <50% memory usage
5. **Production Ready**: Comprehensive error handling and monitoring built-in
