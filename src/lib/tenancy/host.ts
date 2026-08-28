const RESERVED_SUBDOMAINS = new Set([
  'api',
  'app',
  'assets',
  'mail',
  'static',
  'www',
]);

export const TENANT_ID_HEADER = 'x-tenant-id';
export const ROOT_LANDING_HEADER = 'x-root-landing';

export type MultiTenantHost =
  | { type: 'admin' }
  | { type: 'root' }
  | { type: 'tenant'; slug: string }
  | { type: 'unknown' };

export function getHostname(host: string) {
  return host.trim().toLowerCase().split(':')[0];
}

export function getRequestHost(headers: Headers) {
  return (
    headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headers.get('host') ||
    ''
  );
}

export function getSubdomain(host: string, rootDomain: string) {
  const hostname = getHostname(host);
  if (hostname === rootDomain) return null;

  const suffix = `.${rootDomain}`;
  if (!hostname.endsWith(suffix)) return null;

  const subdomain = hostname.slice(0, -suffix.length);
  return subdomain && !subdomain.includes('.') ? subdomain : null;
}

export function isReservedTenantSlug(slug: string) {
  return slug === 'admin' || RESERVED_SUBDOMAINS.has(slug);
}

export function normalizeRootDomain(value: string) {
  const rootDomain = value.trim().toLowerCase().replace(/^\.+/, '');
  const labels = rootDomain.split('.');
  const isValid =
    !rootDomain.includes('://') &&
    !rootDomain.includes('/') &&
    !rootDomain.includes(':') &&
    labels.every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    );

  if (!isValid) {
    throw new Error('ROOT_DOMAIN must be a hostname without protocol or port');
  }

  return rootDomain;
}

export function resolveMultiTenantHost(
  host: string,
  rootDomain: string,
): MultiTenantHost {
  const hostname = getHostname(host);
  if (hostname === rootDomain) return { type: 'root' };

  const slug = getSubdomain(hostname, rootDomain);
  if (!slug) return { type: 'unknown' };
  if (slug === 'admin') return { type: 'admin' };
  if (isReservedTenantSlug(slug)) return { type: 'unknown' };

  return { type: 'tenant', slug };
}
