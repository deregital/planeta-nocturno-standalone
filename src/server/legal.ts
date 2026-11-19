import 'server-only';

import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';

/**
 * Lo que cambia de un tenant a otro en los textos legales: el nombre de la
 * productora (NEXT_PUBLIC_INSTANCE_NAME o el nombre del tenant) y el mail de
 * contacto (INSTANCE_CONTACT_EMAIL o el del tenant, y si falta, el de la
 * plataforma en multi-tenant).
 */
export async function getLegalContext() {
  const { instance } = await getCurrentRequestContext();
  const contactEmail =
    instance.contactEmail?.trim() ||
    process.env.MULTI_TENANT_CONTACT_EMAIL?.trim() ||
    null;

  return {
    producerName: instance.name,
    contactEmail,
    siteHost: new URL(instance.publicUrl).host,
  };
}
