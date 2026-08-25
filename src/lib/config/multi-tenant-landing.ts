type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

export function getMultiTenantLandingConfig(
  environment: EnvironmentVariables = process.env,
) {
  const color = getRequiredValue(environment, 'MULTI_TENANT_LANDING_COLOR');
  if (!/^#[\da-f]{6}$/i.test(color)) {
    throw new Error('MULTI_TENANT_LANDING_COLOR must be a six-digit hex color');
  }

  return {
    name: getRequiredValue(environment, 'MULTI_TENANT_LANDING_NAME'),
    description: getRequiredValue(
      environment,
      'MULTI_TENANT_LANDING_DESCRIPTION',
    ),
    color,
  };
}

function getRequiredValue(environment: EnvironmentVariables, key: string) {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}
