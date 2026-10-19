import type { NextConfig } from "next";

// Static export for GitHub Pages (no Node.js server at runtime).
// Cache Components / Partial Prefetching need a server, so they stay off.
const nextConfig: NextConfig = {
  output: "export",
  // `/plain` -> `/plain/index.html`, which GitHub Pages serves without rewrites
  trailingSlash: true,
  // The default image optimizer needs a server
  images: { unoptimized: true },
  transpilePackages: ["three"],
};

export default nextConfig;
