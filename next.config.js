/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  webpack: (config) => {
    config.optimization.minimize = false;
    return config;
  },
};
module.exports = nextConfig;
