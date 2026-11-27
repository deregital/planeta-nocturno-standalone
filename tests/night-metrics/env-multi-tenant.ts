// Antes que cualquier módulo de la app: la instancia es multi-tenant.
import { SINGLE_TENANT_ENV_KEYS } from '@/lib/config/single-tenant-config';
import {
  databaseUrl,
  SIGNING_SECRET,
} from '@tests/night-metrics/pluto-helpers';

for (const key of SINGLE_TENANT_ENV_KEYS) delete process.env[key];
process.env.ROOT_DOMAIN = 'pn.test';
process.env.CONTROL_DATABASE_URL = databaseUrl('pn_night_metrics_control');
process.env.NEON_API_KEY = 'neon-test-fake';
process.env.NEON_PROJECT_NAME = 'pn-night-metrics';
process.env.CREDENTIALS_SIGNING_SECRET = SIGNING_SECRET;
process.env.VERCEL_GIT_COMMIT_SHA = 'abc1234def';
