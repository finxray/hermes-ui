import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hermes-ui/hermes-client"]
};

export default nextConfig;
