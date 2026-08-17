import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import { resolveInstance } from '@/server/instance/resolve-instance';
import { verifySignedRequest } from '@/server/security/signed-request';

const credentialsSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export async function POST(request: Request) {
  const signedRequest = await verifySignedRequest(request, {
    logPrefix: '[api/credentials/mercadopago]',
  });
  if (!signedRequest.ok) return signedRequest.response;

  let payload: unknown;
  try {
    payload = JSON.parse(signedRequest.rawBody);
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const credentials = credentialsSchema.safeParse(payload);
  if (!credentials.success) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  const instance = await resolveInstance(request.headers);
  if (!instance.tenantId) {
    return NextResponse.json({ error: 'SINGLE_TENANT' }, { status: 409 });
  }

  const [tenant] = await getControlDb()
    .update(tenants)
    .set({
      mpAccessToken: credentials.data.accessToken,
      mpRefreshToken: credentials.data.refreshToken,
      updatedAt: new Date(),
    })
    .where(and(eq(tenants.id, instance.tenantId), eq(tenants.status, 'active')))
    .returning({ id: tenants.id });

  if (!tenant) {
    return NextResponse.json({ error: 'TENANT_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
