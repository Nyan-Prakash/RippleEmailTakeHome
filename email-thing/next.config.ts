import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Mark packages as external to prevent bundling
  serverExternalPackages: ["mjml", "@sparticuz/chromium", "playwright-core"],
  
  // Use standalone output for Vercel with proper file copying
  output: "standalone",
  
  // Ensure chromium binary files are included in the build
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle @sparticuz/chromium - keep it external so files are accessible
      config.externals = config.externals || [];
      config.externals.push('@sparticuz/chromium');
    }
    return config;
  },
};

export default nextConfig;
