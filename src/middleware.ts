import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import {
  isControlSessionValid,
  isTenantSessionValid,
} from '@/lib/auth/session-tenant';
import { createSingleTenantConfig } from '@/lib/config/single-tenant-config';
import {
  getRequestHost,
  normalizeRootDomain,
  resolveMultiTenantHost,
  TENANT_ID_HEADER,
} from '@/lib/tenancy/host';
import { authMiddleware } from '@/server/auth';

export default authMiddleware(async function middleware(request) {
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
    return new NextResponse('Configuración de páginas inválida', {
      status: 503,
    });
  }

  if (target.type === 'admin') {
    if (
      request.nextUrl.pathname === '/api/auth/session' &&
      request.auth &&
      !isControlSessionValid(request.auth)
    ) {
      return NextResponse.json(null);
    }

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
      return new NextResponse('Página no encontrada', { status: 404 });
    }

    if (!tenant.databaseName) {
      return new NextResponse('Página en preparación', { status: 503 });
    }

    const sessionIsValid = isTenantSessionValid(request.auth, tenant.slug);
    if (
      request.nextUrl.pathname === '/api/auth/session' &&
      request.auth &&
      !sessionIsValid
    ) {
      return NextResponse.json(null);
    }

    if (isProtectedTenantPath(request.nextUrl.pathname) && !sessionIsValid) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set(
        'callbackUrl',
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      );
      return NextResponse.redirect(loginUrl);
    }

    headers.set(TENANT_ID_HEADER, tenant.slug);
    return NextResponse.next({ request: { headers } });
  } catch (error) {
    console.error('Tenant lookup failed', { slug: target.slug, error });
    return new NextResponse('Servicio temporalmente no disponible', {
      status: 503,
    });
  }
});

function isProtectedTenantPath(pathname: string) {
  return ['/admin', '/organization', '/profile'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/((?!_next/static|_next/image|icon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2)$).*)',
  ],
};
