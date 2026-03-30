import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker: bundles server + minimal node_modules into .next/standalone
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Redirect legacy URLs if needed
  async redirects() {
    return [];
  },
  // Add canonical headers for SEO
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
