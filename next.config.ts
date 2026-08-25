import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone so the app can be shipped as a single Node process
  // (laptop, VPS, Docker) without needing the full repo at runtime.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
