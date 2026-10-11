import type { NextConfig } from "next";
import { BACKEND_API_URL } from "./src/constants/ApiConstants";

const nextConfig: NextConfig = {
  // Proxy API calls through this app so the HTTPS site never requests the
  // HTTP-only backend directly (browsers block that as mixed content).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_API_URL}/:path*` }];
  },
};

export default nextConfig;
