import type { NextConfig } from "next";

// Proxy the API so the browser only ever talks to one origin: the session
// cookie then needs no CORS or SameSite exceptions.
// Note: Next rewrites do not proxy WebSockets — the socket in Phase 3 connects
// to the backend directly.
const API_URL = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
