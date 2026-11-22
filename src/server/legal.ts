import 'server-only';

import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';

/**
 * Mail de contacto de la productora: INSTANCE_CONTACT_EMAIL o el del tenant,
 * y si falta, el de la plataforma en multi-tenant.
 */
export function resolveContactEmail(
  instance: Pick<ResolvedInstance, 'contactEmail'>,
) {
  return (
    instance.contactEmail?.trim() ||
    process.env.MULTI_TENANT_CONTACT_EMAIL?.trim() ||
    null
  );
}

/**
 * Lo que cambia de un tenant a otro en los textos legales: el nombre de la
 * productora (NEXT_PUBLIC_INSTANCE_NAME o el nombre del tenant) y el mail de
 * contacto.
 */
export async function getLegalContext() {
  const { instance } = await getCurrentRequestContext();

  return {
    producerName: instance.name,
    contactEmail: resolveContactEmail(instance),
    siteHost: new URL(instance.publicUrl).host,
  };
}
