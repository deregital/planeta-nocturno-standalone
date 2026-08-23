type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

const DEFAULT_LANDING = {
  name: 'Nuestros Tickets',
  description: 'Todas tus experiencias, en un solo lugar.',
  color: '#7c3aed',
} as const;

export function getMultiTenantLandingConfig(
  environment: EnvironmentVariables = process.env,
) {
  const color = environment.MULTI_TENANT_LANDING_COLOR?.trim();

  return {
    name: environment.MULTI_TENANT_LANDING_NAME?.trim() || DEFAULT_LANDING.name,
    description:
      environment.MULTI_TENANT_LANDING_DESCRIPTION?.trim() ||
      DEFAULT_LANDING.description,
    color:
      color && /^#[\da-f]{6}$/i.test(color) ? color : DEFAULT_LANDING.color,
  };
}
