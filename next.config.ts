import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    /* config options here */
    reactCompiler: true,
    async rewrites() {
        return [
            {
                source: '/manifest.json',
                destination: '/api/eclipse/manifest.json',
            },
        ];
    },
};

export default nextConfig;
