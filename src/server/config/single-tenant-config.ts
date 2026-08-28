import 'server-only';

import {
  createSingleTenantConfig,
  type SingleTenantConfig,
} from '@/lib/config/single-tenant-config';

let singleTenantConfig: SingleTenantConfig | null | undefined;

export function getSingleTenantConfig() {
  if (singleTenantConfig === undefined) {
    singleTenantConfig = createSingleTenantConfig(process.env);
  }

  return singleTenantConfig;
}
