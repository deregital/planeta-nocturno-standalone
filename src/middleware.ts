import { type NextRequest, NextResponse } from 'next/server';

import { createSingleTenantConfig } from '@/lib/config/single-tenant-config';

const MULTI_TENANT_PREVIEW_PATH = '/multi-tenant-preview';

export function middleware(request: NextRequest) {
  if (createSingleTenantConfig(process.env)) {
    return NextResponse.next();
  }

  console.info('[Planeta Nocturno] Instancia multi-tenant en modo de prueba.');

  if (request.nextUrl.pathname === MULTI_TENANT_PREVIEW_PATH) {
    return NextResponse.next();
  }

  const previewUrl = request.nextUrl.clone();
  previewUrl.pathname = MULTI_TENANT_PREVIEW_PATH;
  return NextResponse.rewrite(previewUrl);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|icon.ico).*)'],
};
