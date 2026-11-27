import 'server-only';

import type { z } from 'zod';

import { NextResponse } from 'next/server';

import { verifySignedRequest } from '@/server/security/signed-request';

/** Verifica la firma de Pluto y valida el cuerpo contra `schema`. */
export async function readSignedPlutoBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
  logPrefix: string,
): Promise<
  { ok: true; body: z.infer<Schema> } | { ok: false; response: NextResponse }
> {
  const signed = await verifySignedRequest(request, { logPrefix });
  if (!signed.ok) return signed;

  let json: unknown;
  try {
    json = JSON.parse(signed.rawBody);
  } catch {
    json = undefined;
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'BAD_REQUEST', message: 'Body inválido.' },
        { status: 400 },
      ),
    };
  }
  return { ok: true, body: parsed.data };
}
