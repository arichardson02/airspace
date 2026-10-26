import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Bundles only the files needed to run into .next/standalone, for a small Docker image.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
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
