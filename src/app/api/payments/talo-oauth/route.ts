import { NextResponse } from 'next/server';

import { createSingleTenantConfig } from '@/lib/config/single-tenant-config';
import { TALO_CONNECT_COMPLETE_PATH } from '@/lib/payments/talo-paths';
import { getTenantPublicUrl } from '@/server/control/tenant-public-url';

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Vuelta de "Conectar con Talo" (la URL de redirección registrada en Talo).
 * No conecta nada: lleva el código a la página de la plataforma que lo pidió
 * (por `referred_user_id`), donde la persona tiene la sesión iniciada y se
 * verifica que haya empezado ella la conexión.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const referred = url.searchParams.get('referred_user_id');

  const target = (base: string) => {
    const next = new URL(TALO_CONNECT_COMPLETE_PATH, base);
    if (code) next.searchParams.set('code', code);
    if (referred) next.searchParams.set('referred_user_id', referred);
    return NextResponse.redirect(next, { status: 303 });
  };

  if (createSingleTenantConfig(process.env)) {
    return target(url.origin);
  }

  // Sólo subdominios de la plataforma: no es un redirect abierto.
  if (!referred || !SLUG_PATTERN.test(referred) || referred === 'default') {
    return new NextResponse('Autorización de Talo sin plataforma', {
      status: 400,
    });
  }
  return target(getTenantPublicUrl(referred, request.headers));
}
