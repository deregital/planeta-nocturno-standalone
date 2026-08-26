/* eslint-disable no-restricted-imports -- next.config.ts loads this module before path aliases are available. */
import { normalizeRootDomain } from '../tenancy/host';

import {
  createSingleTenantConfig,
  SINGLE_TENANT_ENV_KEYS,
  SINGLE_TENANT_REQUIRED_ENV_KEYS,
} from './single-tenant-config';
/* eslint-enable no-restricted-imports */

type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

export const SHARED_REQUIRED_ENV_KEYS = [
  'AUTH_SECRET',
  'AWS_ACCESS_KEY_ID',
  'AWS_REGION',
  'AWS_SECRET_ACCESS_KEY',
  'BARCODE_SECRET',
  'CREDENTIALS_SIGNING_SECRET',
  'GUIDE_URL',
  'MP_SECRET_KEY',
  'NEXT_PUBLIC_S3_BUCKET_URL',
  'PLUTO_URL',
  'RESEND_API_KEY',
  'RESEND_DOMAIN',
] as const;

export const MULTI_TENANT_REQUIRED_ENV_KEYS = [
  'CONTROL_DATABASE_URL',
  'MULTI_TENANT_LANDING_COLOR',
  'MULTI_TENANT_LANDING_DESCRIPTION',
  'MULTI_TENANT_LANDING_NAME',
  'NEON_API_KEY',
  'NEON_PROJECT_NAME',
  'ROOT_DOMAIN',
] as const;

export type EnvironmentMode = 'single-tenant' | 'multi-tenant';

export function validateEnvironment(
  environment: EnvironmentVariables,
): EnvironmentMode {
  const mode = getEnvironmentMode(environment);
  const modeKeys =
    mode === 'single-tenant'
      ? SINGLE_TENANT_REQUIRED_ENV_KEYS
      : MULTI_TENANT_REQUIRED_ENV_KEYS;
  const issues = findMissingKeys(environment, [
    ...SHARED_REQUIRED_ENV_KEYS,
    ...modeKeys,
  ]);

  if (mode === 'single-tenant') {
    const multiTenantKeys = configuredKeys(
      environment,
      MULTI_TENANT_REQUIRED_ENV_KEYS,
    );
    if (multiTenantKeys.length > 0) {
      issues.push(
        `No mezclar variables single-tenant con: ${multiTenantKeys.join(', ')}`,
      );
    }

    if (
      findMissingKeys(environment, SINGLE_TENANT_REQUIRED_ENV_KEYS).length === 0
    ) {
      try {
        createSingleTenantConfig(environment);
      } catch (error) {
        issues.push(error instanceof Error ? error.message : 'Invalid config');
      }
    }
  } else {
    validateRootDomain(environment, issues);
  }

  validateDatabaseUrl(environment, 'DATABASE_URL', issues);
  validateDatabaseUrl(environment, 'CONTROL_DATABASE_URL', issues);
  validateHttpUrl(environment, 'GUIDE_URL', issues);
  validateHttpUrl(environment, 'PLUTO_URL', issues);
  validateHttpUrl(environment, 'NEXT_PUBLIC_S3_BUCKET_URL', issues);
  validateHttpUrl(environment, 'NEXT_PUBLIC_FAVICON_URL', issues);
  validateEmail(environment, 'INSTANCE_CONTACT_EMAIL', issues);
  validateLandingColor(environment, issues);

  if (issues.length > 0) {
    throw new Error(
      [
        `Invalid ${mode} environment:`,
        ...issues.map((issue) => `- ${issue}`),
      ].join('\n'),
    );
  }

  return mode;
}

export function getRequiredEnvironmentValue(
  environment: EnvironmentVariables,
  key: string,
) {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function getEnvironmentMode(
  environment: EnvironmentVariables,
): EnvironmentMode {
  return configuredKeys(environment, SINGLE_TENANT_ENV_KEYS).length > 0
    ? 'single-tenant'
    : 'multi-tenant';
}

function findMissingKeys(
  environment: EnvironmentVariables,
  keys: readonly string[],
) {
  return keys
    .filter((key) => !environment[key]?.trim())
    .map((key) => `${key} is required`);
}

function configuredKeys(
  environment: EnvironmentVariables,
  keys: readonly string[],
) {
  return keys.filter((key) => Boolean(environment[key]?.trim()));
}

function validateDatabaseUrl(
  environment: EnvironmentVariables,
  key: string,
  issues: string[],
) {
  const value = environment[key]?.trim();
  if (!value) return;

  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  } catch {
    issues.push(`${key} must be a PostgreSQL URL`);
  }
}

function validateHttpUrl(
  environment: EnvironmentVariables,
  key: string,
  issues: string[],
) {
  const value = environment[key]?.trim();
  if (!value) return;

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    issues.push(`${key} must be an HTTP(S) URL`);
  }
}

function validateEmail(
  environment: EnvironmentVariables,
  key: string,
  issues: string[],
) {
  const value = environment[key]?.trim();
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    issues.push(`${key} must be an email address`);
  }
}

function validateRootDomain(
  environment: EnvironmentVariables,
  issues: string[],
) {
  const rootDomain = environment.ROOT_DOMAIN?.trim();
  if (!rootDomain) return;

  try {
    normalizeRootDomain(rootDomain);
  } catch {
    issues.push('ROOT_DOMAIN must be a hostname without protocol or port');
  }
}

function validateLandingColor(
  environment: EnvironmentVariables,
  issues: string[],
) {
  const color = environment.MULTI_TENANT_LANDING_COLOR?.trim();
  if (color && !/^#[\da-f]{6}$/i.test(color)) {
    issues.push('MULTI_TENANT_LANDING_COLOR must be a six-digit hex color');
  }
}
