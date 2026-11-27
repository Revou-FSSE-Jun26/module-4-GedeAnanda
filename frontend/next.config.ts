import type { NextConfig } from "next";

// Cache Components (and Partial Prefetching, which requires it) are left off:
// every page here shows per-user data read with the session cookie, so there is
// nothing to prerender or cache, and requests are simply rendered on demand.
const nextConfig: NextConfig = {
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
