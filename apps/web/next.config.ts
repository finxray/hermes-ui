import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hermes-ui/hermes-client"],
  // Next 16 blocks cross-origin dev-resource (HMR/RSC) requests by default. The
  // smoke runner uses 127.0.0.1, so allow that host or the client bundle never
  // hydrates and the UI looks dead.
  allowedDevOrigins: ["127.0.0.1"]
};

export default nextConfig;
