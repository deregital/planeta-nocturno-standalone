export const SINGLE_TENANT_ENV_KEYS = [
  'DATABASE_URL',
  'INSTANCE_CONTACT_EMAIL',
  'INSTANCE_WEB_URL',
  'MP_ACCESS_TOKEN',
  'MP_REFRESH_TOKEN',
  'MP_SECRET_KEY',
  'NEXT_PUBLIC_FAVICON_URL',
  'NEXT_PUBLIC_HUE',
  'NEXT_PUBLIC_INSTANCE_DESCRIPTION',
  'NEXT_PUBLIC_INSTANCE_NAME',
  'NEXT_PUBLIC_SATURATION',
  'NEXT_PUBLIC_SITE_URL',
] as const;

type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

export type SingleTenantConfig = {
  databaseUrl: string;
  name: string;
  publicUrl: string;
  siteUrl: string;
  contactEmail?: string;
  description?: string;
  faviconUrl?: string;
  hue: number;
  saturation: number;
  mercadoPagoAccessToken?: string;
  mercadoPagoRefreshToken?: string;
  mercadoPagoSecretKey?: string;
};

function readOptionalValue(environment: EnvironmentVariables, key: string) {
  return environment[key]?.trim() || undefined;
}

function readRequiredValue(environment: EnvironmentVariables, key: string) {
  const value = readOptionalValue(environment, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

export function createSingleTenantConfig(
  environment: EnvironmentVariables,
): SingleTenantConfig | null {
  const isSingleTenant = SINGLE_TENANT_ENV_KEYS.some((key) =>
    readOptionalValue(environment, key),
  );

  if (!isSingleTenant) return null;

  const publicUrl = normalizePublicUrl(
    readRequiredValue(environment, 'INSTANCE_WEB_URL'),
    'INSTANCE_WEB_URL',
  );

  return {
    databaseUrl: readRequiredValue(environment, 'DATABASE_URL'),
    name: readRequiredValue(environment, 'NEXT_PUBLIC_INSTANCE_NAME'),
    publicUrl,
    siteUrl: normalizePublicUrl(
      readOptionalValue(environment, 'NEXT_PUBLIC_SITE_URL') ?? publicUrl,
      'NEXT_PUBLIC_SITE_URL',
    ),
    contactEmail: readOptionalValue(environment, 'INSTANCE_CONTACT_EMAIL'),
    description: readOptionalValue(
      environment,
      'NEXT_PUBLIC_INSTANCE_DESCRIPTION',
    ),
    faviconUrl: readOptionalValue(environment, 'NEXT_PUBLIC_FAVICON_URL'),
    hue: readOptionalNumber(environment, 'NEXT_PUBLIC_HUE', 0, 360) ?? 200,
    saturation:
      readOptionalNumber(environment, 'NEXT_PUBLIC_SATURATION', 0, 100) ?? 100,
    mercadoPagoAccessToken: readOptionalValue(environment, 'MP_ACCESS_TOKEN'),
    mercadoPagoRefreshToken: readOptionalValue(environment, 'MP_REFRESH_TOKEN'),
    mercadoPagoSecretKey: readOptionalValue(environment, 'MP_SECRET_KEY'),
  };
}

function normalizePublicUrl(value: string, key: string) {
  const candidate = value.includes('://') ? value : `https://${value}`;

  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    if (url.pathname !== '/' || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new Error(`${key} must be an HTTP(S) origin`);
  }
}

function readOptionalNumber(
  environment: EnvironmentVariables,
  key: string,
  minimum: number,
  maximum: number,
) {
  const value = readOptionalValue(environment, key);
  if (value === undefined) return undefined;

  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`${key} must be between ${minimum} and ${maximum}`);
  }

  return number;
}
