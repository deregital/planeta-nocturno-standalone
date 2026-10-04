import 'server-only';

import {
  getHostname,
  getRequestHost,
  normalizeRootDomain,
} from '@/lib/tenancy/host';

/** URL pública de un tenant, con el protocolo y puerto del panel actual. */
export function getTenantPublicUrl(slug: string, requestHeaders: Headers) {
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN ?? '');
  const requestHost = getRequestHost(requestHeaders);
  const hostname = getHostname(requestHost);
  const forwardedProtocol = requestHeaders
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const protocol =
    forwardedProtocol === 'http' || forwardedProtocol === 'https'
      ? forwardedProtocol
      : hostname === 'localhost' || hostname.endsWith('.localhost')
        ? 'http'
        : 'https';
  const port = new URL(`${protocol}://${requestHost}`).port;

  return `${protocol}://${slug}.${rootDomain}${port ? `:${port}` : ''}`;
}
