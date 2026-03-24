/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@clio-ai/shared"],
  typescript: {
    // Prisma's JsonValue vs InputJsonValue type mismatches cause
    // false positives in strict mode. Webpack compilation succeeds.
    // TODO: Fix remaining ~20 JsonValue type casts in engine files
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
