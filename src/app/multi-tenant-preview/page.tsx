import { headers } from 'next/headers';

import { getRequestHost, resolveMultiTenantHost } from '@/lib/tenancy/host';
import {
  findTenantBySlug,
  getConfiguredRootDomain,
} from '@/server/instance/resolve-instance';

export const dynamic = 'force-dynamic';

export default async function MultiTenantPreviewPage() {
  const requestHeaders = new Headers(await headers());
  const host = getRequestHost(requestHeaders);

  let target;
  try {
    target = resolveMultiTenantHost(host, getConfiguredRootDomain());
  } catch (error) {
    console.error(
      '[Planeta Nocturno] Configuración multi-tenant inválida',
      error,
    );
    return (
      <PreviewMessage
        title='Configuración incompleta'
        description='ROOT_DOMAIN no está configurado correctamente.'
      />
    );
  }

  if (target.type === 'admin') {
    return (
      <PreviewMessage
        title='Administración multi-tenant'
        description='El panel de administración de tenants se habilitará en una próxima etapa.'
      />
    );
  }

  if (target.type === 'root') {
    return (
      <PreviewMessage
        title='Instancia multi-tenant'
        description='Usá un subdominio para identificar un tenant.'
      />
    );
  }

  if (target.type === 'unknown') {
    return (
      <PreviewMessage
        title='Dominio no reconocido'
        description='Este dominio no corresponde a la instancia multi-tenant.'
      />
    );
  }

  let tenant;
  try {
    tenant = await findTenantBySlug(target.slug);
  } catch (error) {
    console.error(
      '[Planeta Nocturno] No se pudo consultar la base central',
      error,
    );
    return (
      <PreviewMessage
        title='Base central no disponible'
        description='No se pudo resolver el tenant solicitado.'
      />
    );
  }

  if (!tenant) {
    console.info('[Planeta Nocturno] Tenant no encontrado', {
      slug: target.slug,
    });
    return (
      <PreviewMessage
        title='Tenant no encontrado'
        description={`No existe un tenant con el slug “${target.slug}”.`}
      />
    );
  }

  console.info('[Planeta Nocturno] Tenant resuelto', {
    id: tenant.id,
    slug: tenant.slug,
    status: tenant.status,
    hasDatabase: Boolean(tenant.databaseName),
  });

  return (
    <PreviewMessage
      title={tenant.name}
      description={`Tenant “${tenant.slug}” resuelto desde la base central.`}
      details={[
        `Estado: ${tenant.status}`,
        `Base operativa: ${tenant.databaseName ? 'configurada' : 'pendiente'}`,
      ]}
    />
  );
}

function PreviewMessage({
  title,
  description,
  details = [],
}: {
  title: string;
  description: string;
  details?: string[];
}) {
  return (
    <main className='flex min-h-screen items-center justify-center p-6'>
      <div className='max-w-xl text-center'>
        <p className='mb-2 text-sm font-medium uppercase'>Planeta Nocturno</p>
        <h1 className='text-3xl font-bold'>{title}</h1>
        <p className='mt-4 text-base text-gray-600'>{description}</p>
        {details.map((detail) => (
          <p key={detail} className='mt-2 text-sm text-gray-500'>
            {detail}
          </p>
        ))}
      </div>
    </main>
  );
}
