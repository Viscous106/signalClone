import type { NextConfig } from "next";

/**
 * The frontend builds to a static bundle that the FastAPI app serves itself.
 *
 * One service, one origin: no CORS, no rewrites, and the WebSocket is
 * same-origin — Next rewrites could never have proxied it anyway.
 */
const nextConfig: NextConfig = {
  output: "export",
  // Directory-style URLs, so a plain static file server resolves /chat/ too.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
