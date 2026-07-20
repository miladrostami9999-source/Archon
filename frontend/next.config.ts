import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // Serve the static landing page at the root URL. The dashboard now
      // lives at /dashboard; visitors to "/" see the marketing page, and
      // the landing script bounces already-signed-in users to /dashboard.
      beforeFiles: [{ source: "/", destination: "/landing.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
