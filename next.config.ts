import type { NextConfig } from 'next';

import { PHASE_PRODUCTION_BUILD } from 'next/constants';

import { posthogProxyRewrites } from '@/lib/analytics/posthog-proxy';
import { validateEnvironment } from '@/lib/config/environment';

const config: NextConfig = {
  outputFileTracingIncludes: {
    '/*': ['./prisma/migrations/**/*'],
  },
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
  // Requerido por el proxy de PostHog: sus endpoints usan barra final.
  skipTrailingSlashRedirect: true,
  rewrites: async () =>
    posthogProxyRewrites(process.env.NEXT_PUBLIC_POSTHOG_HOST),
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) validateEnvironment(process.env);
  return config;
}
