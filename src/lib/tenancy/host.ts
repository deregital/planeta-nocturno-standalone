export function getHostname(host: string) {
  return host.trim().toLowerCase().split(':')[0];
}

export function getSubdomain(host: string, rootDomain: string) {
  const hostname = getHostname(host);
  if (hostname === rootDomain) return null;

  const suffix = `.${rootDomain}`;
  if (!hostname.endsWith(suffix)) return null;

  const subdomain = hostname.slice(0, -suffix.length);
  return subdomain && !subdomain.includes('.') ? subdomain : null;
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
