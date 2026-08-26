import type { NextConfig } from "next";

/**
 * Static export.
 *
 * All state lives in Firebase, so there is no server to run: `next build`
 * emits plain HTML/JS into `out/`, which GitHub Pages serves directly. Nothing
 * can crash mid-session because nothing is running.
 *
 * `basePath` is set by the deploy workflow because GitHub Pages serves a
 * project site from /<repo>. It stays empty for local development.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // Escape hatch for working inside a synced folder (OneDrive, Dropbox). Those
  // clients turn build artefacts into cloud placeholders mid-build, which makes
  // Next fail with EINVAL on readlink. Point this somewhere unsynced:
  //   NEXT_DIST_DIR=C:\Temp\neis-build npm run build
  // The exported site still lands in ./out either way.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // GitHub Pages resolves /breakout/grid/ to /breakout/grid/index.html, which
  // is what the export produces. Without this, those URLs 404.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
