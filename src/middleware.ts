import { NextResponse } from 'next/server';

import {
  isControlSessionValid,
  isTenantSessionValid,
} from '@/lib/auth/session-tenant';
import { createSingleTenantConfig } from '@/lib/config/single-tenant-config';
import {
  getRequestHost,
  getRequestOrigin,
  normalizeRootDomain,
  replaceTenantSubdomain,
  resolveMultiTenantHost,
  ROOT_LANDING_HEADER,
  TENANT_ID_HEADER,
} from '@/lib/tenancy/host';
import { authMiddleware } from '@/server/auth';
import { findTenantByHostSlug } from '@/server/instance/resolve-instance';
import { logger } from '@/server/observability/logger';

export default authMiddleware(async function middleware(request) {
  const headers = new Headers(request.headers);
  headers.delete(ROOT_LANDING_HEADER);
  headers.delete(TENANT_ID_HEADER);

  if (createSingleTenantConfig(process.env)) {
    return NextResponse.next({ request: { headers } });
  }

  let target;
  try {
    const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN ?? '');
    target = resolveMultiTenantHost(getRequestHost(headers), rootDomain);
  } catch (error) {
    logger.error('Invalid multi-tenant configuration', { error });
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
    if (request.nextUrl.pathname !== '/') {
      return new NextResponse('Página no encontrada', { status: 404 });
    }

    headers.set(ROOT_LANDING_HEADER, '1');
    const url = request.nextUrl.clone();
    url.pathname = '/landing';
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (target.type === 'unknown') {
    return new NextResponse('Dominio no reconocido', { status: 404 });
  }

  try {
    const tenant = await findTenantByHostSlug(target.slug);

    if (tenant?.status !== 'active') {
      return new NextResponse('Página no encontrada', { status: 404 });
    }

    if (!tenant.databaseName) {
      return new NextResponse('Página en preparación', { status: 503 });
    }

    // Los subdominios anteriores redirigen las páginas, pero atienden las
    // APIs directo: los webhooks y callbacks firmados no siguen redirects.
    if (
      tenant.slug !== target.slug &&
      !request.nextUrl.pathname.startsWith('/api/')
    ) {
      const host = replaceTenantSubdomain(getRequestHost(headers), tenant.slug);
      return NextResponse.redirect(
        new URL(
          `${request.nextUrl.pathname}${request.nextUrl.search}`,
          getRequestOrigin(headers, host),
        ),
        308,
      );
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
    logger.error('Tenant lookup failed', {
      instance_key: target.slug,
      error,
    });
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
  // `relay` es el proxy de PostHog (POSTHOG_PROXY_PATH): lo resuelven los
  // rewrites de next.config.ts y no debe pasar por el ruteo de tenants.
  matcher: [
    '/((?!_next/static|_next/image|relay/|icon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2)$).*)',
  ],
};
