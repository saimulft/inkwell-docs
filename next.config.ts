import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
  // Native/WASM and DOM-emulation packages run as plain Node modules instead of being bundled.
  serverExternalPackages: ['@electric-sql/pglite', 'happy-dom', 'mammoth'],
  poweredByHeader: false,
};

export default nextConfig;
