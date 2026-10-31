import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  /* config options here */
  // Bundles only the files needed to run into .next/standalone, for a small Docker image.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // In production App Platform routes /api to the backend before it reaches Next. In dev this
  // does the same, so auth cookies stay on the site's own origin.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
