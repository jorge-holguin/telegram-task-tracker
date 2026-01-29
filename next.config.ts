import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // Permitir videos hasta 50MB (límite de Telegram)
    },
  },
};

export default nextConfig;
