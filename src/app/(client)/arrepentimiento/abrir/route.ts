import { type NextRequest, NextResponse } from 'next/server';

import { WITHDRAWAL_PATH } from '@/lib/withdrawal';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import {
  readWithdrawalToken,
  WITHDRAWAL_COOKIE,
} from '@/server/services/withdrawal';

/**
 * Link del mail. Guarda el token en una cookie y redirige a la lista de
 * compras: la página se ve sin el token en la URL, así no queda en el
 * historial ni llega a la analítica. Un link vencido vuelve al formulario.
 */
export async function GET(request: NextRequest) {
  const { instance } = await getCurrentRequestContext();
  const token = request.nextUrl.searchParams.get('t') ?? '';
  const access = token ? readWithdrawalToken(token, instance.slug) : null;

  const target = new URL(
    access ? `${WITHDRAWAL_PATH}/compras` : `${WITHDRAWAL_PATH}?link=vencido`,
    instance.publicUrl,
  );
  const response = NextResponse.redirect(target, 303);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  if (access) {
    response.cookies.set(WITHDRAWAL_COOKIE, token, {
      httpOnly: true,
      secure: new URL(instance.publicUrl).protocol === 'https:',
      sameSite: 'lax',
      path: WITHDRAWAL_PATH,
      expires: new Date(access.expiresAt),
    });
  }
  return response;
}
