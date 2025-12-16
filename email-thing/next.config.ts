import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Mark packages as external to prevent bundling
  // This works automatically with both Turbopack and webpack
  serverExternalPackages: ["mjml", "@sparticuz/chromium", "playwright-core"],
  
  // Use standalone output for Vercel with proper file copying
  output: "standalone",
  
  // Empty turbopack config to silence Next.js 16 warning
  // serverExternalPackages handles everything we need
  turbopack: {},
};

export default nextConfig;
