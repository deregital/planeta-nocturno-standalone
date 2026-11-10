import type { NextConfig } from 'next';

import { withPostHogConfig } from '@posthog/nextjs-config';
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
      // Páginas con datos del ticket (nombre, DNI, QR): el id de la URL funciona
      // como llave, así que no se indexa ni se filtra a terceros vía Referer
      // (links a Maps, imágenes externas). Al ir después, pisa el Referrer-Policy global.
      ...['/tickets/:path*', '/event/:slug/ticket'].map((source) => ({
        source,
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      })),
    ];
  },
};

function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) validateEnvironment(process.env);
  return config;
}

export default withPostHogConfig(nextConfig, {
  personalApiKey: process.env.POSTHOG_API_KEY ?? '',
  projectId: process.env.POSTHOG_PROJECT_ID,
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  sourcemaps: {
    enabled: Boolean(
      process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID,
    ),
    deleteAfterUpload: true,
    // Si PostHog no responde o la key falla, el deploy sigue: los maps se
    // borran igual y sólo quedan minificados los errores de ese deploy.
    failOnError: false,
  },
});
