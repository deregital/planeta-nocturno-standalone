import 'server-only';

import {
  getRequestHost,
  normalizeRootDomain,
  resolveMultiTenantHost,
} from '@/lib/tenancy/host';
import { getSingleTenantConfig } from '@/server/config/single-tenant-config';

export function isControlRequest(headers: Headers) {
  if (getSingleTenantConfig()) return false;

  const rootDomain = process.env.ROOT_DOMAIN;
  if (!rootDomain) throw new Error('ROOT_DOMAIN is required');

  return (
    resolveMultiTenantHost(
      getRequestHost(headers),
      normalizeRootDomain(rootDomain),
    ).type === 'admin'
  );
}
