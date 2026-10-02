/**
 * Ruta del reverse proxy hacia PostHog. Si se cambia, actualizar también el
 * `matcher` de `src/middleware.ts` (tiene que ser un literal).
 */
export const POSTHOG_PROXY_PATH = '/relay';

/** Rewrites hacia PostHog Cloud a partir de `NEXT_PUBLIC_POSTHOG_HOST`. */
export function posthogProxyRewrites(posthogHost: string | undefined) {
  if (!posthogHost) return [];

  const ingestHost = posthogHost.replace(/\/$/, '');
  const assetsHost = ingestHost.replace(/:\/\/(us|eu)\.i\./, '://$1-assets.i.');

  return [
    {
      source: `${POSTHOG_PROXY_PATH}/static/:path*`,
      destination: `${assetsHost}/static/:path*`,
    },
    {
      source: `${POSTHOG_PROXY_PATH}/array/:path*`,
      destination: `${assetsHost}/array/:path*`,
    },
    {
      source: `${POSTHOG_PROXY_PATH}/:path*`,
      destination: `${ingestHost}/:path*`,
    },
  ];
}
