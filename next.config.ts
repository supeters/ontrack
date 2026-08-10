import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable Turbopack - use standard webpack instead
  // turbo: false is not needed in Next.js 15+, just don't use --turbo flag
};

export default nextConfig;
