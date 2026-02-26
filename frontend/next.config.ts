import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@stacks/connect",
    "@stacks/transactions",
    "@stacks/network",
  ],
  // All pages are client-rendered
  output: undefined,
};

export default nextConfig;
