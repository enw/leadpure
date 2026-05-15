/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
};

export default nextConfig;
