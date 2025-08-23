import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      new URL(
        'https://i1.sndcdn.com/artworks-6ynRG9wIT0n9MmI6-LmuH4Q-t500x500.jpg',
      ),
      {
        protocol: 'https',
        hostname: 'media.tenor.com',
      },
      {
        protocol: 'https',
        hostname: 'planeta-nocturno.s3.us-east-1.amazonaws.com',
      },
    ],
  },
  typedRoutes: true,
};

export default nextConfig;
