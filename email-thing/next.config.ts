import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Mark packages as external to prevent bundling
  serverExternalPackages: ["mjml", "@sparticuz/chromium", "puppeteer-core"],
  
  // Use standalone output for Vercel with proper file copying
  output: "standalone",
  
  // Empty turbopack config to silence the warning (most apps work fine with no config)
  turbopack: {},
  
  // Ensure @sparticuz/chromium binary files are accessible (for webpack mode)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle @sparticuz/chromium - keep it external so binaries are accessible
      config.externals = config.externals || [];
      config.externals.push('@sparticuz/chromium');
    }
    return config;
  },
};

export default nextConfig;
