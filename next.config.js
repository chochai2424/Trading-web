/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep yahoo-finance2 out of the webpack bundle — its ESM build
    // references Deno-only test modules that break bundling.
    serverComponentsExternalPackages: ["yahoo-finance2"],
  },
};

module.exports = nextConfig;
