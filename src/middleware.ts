import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import { createSingleTenantConfig } from '@/lib/config/single-tenant-config';
import {
  getRequestHost,
  normalizeRootDomain,
  resolveMultiTenantHost,
  TENANT_ID_HEADER,
} from '@/lib/tenancy/host';

export async function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(TENANT_ID_HEADER);

  if (createSingleTenantConfig(process.env)) {
    return NextResponse.next({ request: { headers } });
  }

  let target;
  try {
    const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN ?? '');
    target = resolveMultiTenantHost(getRequestHost(headers), rootDomain);
  } catch (error) {
    console.error('Invalid multi-tenant configuration', error);
    return new NextResponse('Configuración multi-tenant inválida', {
      status: 503,
    });
  }

  if (target.type === 'admin') {
    if (request.nextUrl.pathname.startsWith('/api/auth')) {
      return NextResponse.next({ request: { headers } });
    }

    const url = request.nextUrl.clone();
    url.pathname = `/control${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (target.type === 'root') {
    return NextResponse.next({ request: { headers } });
  }

  if (target.type === 'unknown') {
    return new NextResponse('Dominio no reconocido', { status: 404 });
  }

  try {
    const [tenant] = await getControlDb()
      .select({
        slug: tenants.slug,
        databaseName: tenants.databaseName,
      })
      .from(tenants)
      .where(and(eq(tenants.slug, target.slug), eq(tenants.status, 'active')))
      .limit(1);

    if (!tenant) {
      return new NextResponse('Tenant no encontrado', { status: 404 });
    }

    if (!tenant.databaseName) {
      return new NextResponse('Tenant en preparación', { status: 503 });
    }

    headers.set(TENANT_ID_HEADER, tenant.slug);
    return NextResponse.next({ request: { headers } });
  } catch (error) {
    console.error('Tenant lookup failed', { slug: target.slug, error });
    return new NextResponse('Servicio temporalmente no disponible', {
      status: 503,
    });
  }
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/((?!_next/static|_next/image|icon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2)$).*)',
  ],
};
