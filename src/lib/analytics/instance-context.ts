export type AnalyticsArea = 'tenant' | 'control' | 'landing';

export type InstanceAnalyticsContext = {
  area: AnalyticsArea;
  mode: 'single-tenant' | 'multi-tenant';
  key: string | null;
  name: string | null;
};

/**
 * Data attributes que el root layout escribe en `<html>` para que
 * `instrumentation-client` sepa en qué instancia está antes de hidratar.
 */
export function instanceContextDataAttributes(
  context: InstanceAnalyticsContext,
) {
  return {
    'data-analytics-area': context.area,
    'data-analytics-mode': context.mode,
    'data-analytics-instance': context.key ?? undefined,
    'data-analytics-instance-name': context.name ?? undefined,
  };
}

export function readInstanceContext(
  element: HTMLElement,
): InstanceAnalyticsContext {
  const {
    analyticsArea,
    analyticsMode,
    analyticsInstance,
    analyticsInstanceName,
  } = element.dataset;

  return {
    area: (analyticsArea as AnalyticsArea | undefined) ?? 'tenant',
    mode: analyticsMode === 'single-tenant' ? 'single-tenant' : 'multi-tenant',
    key: analyticsInstance ?? null,
    name: analyticsInstanceName ?? null,
  };
}

const AREA_LABEL: Record<AnalyticsArea, string> = {
  tenant: 'Tenant',
  control: 'Control',
  landing: 'Landing',
};

/** Nombre legible del tenant para mostrar en PostHog. */
export function tenantLabel(context: InstanceAnalyticsContext) {
  return context.name ?? context.key ?? AREA_LABEL[context.area];
}

/** `anon / <uuid> - <Tenant>`: así se ven los visitantes no logueados. */
export function anonymousDistinctId(
  uuid: string,
  context: InstanceAnalyticsContext,
) {
  return `anon / ${uuid} - ${tenantLabel(context)}`;
}

/** `Nombre Apellido - <Tenant>`: nombre visible de un usuario identificado. */
export function personDisplayName(
  fullName: string | null | undefined,
  context: InstanceAnalyticsContext,
) {
  return `${fullName?.trim() || 'Sin nombre'} - ${tenantLabel(context)}`;
}

/** Clave estable de la instancia: el slug en multi-tenant, el host en single. */
export function instanceAnalyticsKey(instance: {
  slug: string | null;
  siteUrl: string;
}) {
  return instance.slug ?? new URL(instance.siteUrl).hostname;
}
