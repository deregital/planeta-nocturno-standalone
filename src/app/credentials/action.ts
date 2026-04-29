'use server';

import { createHmac } from 'crypto';

import { type Route } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { auth } from '@/server/auth';
import { getDefaultPathByRole } from '@/server/utils/authRedirect';

const saveCredentialsSchema = z.object({
  accessToken: z.string().min(1, 'El access token es obligatorio'),
  secretKey: z.string().min(1, 'La secret key es obligatoria'),
});

function signPayload(timestamp: string, rawBody: string) {
  const signingSecret = process.env.CREDENTIALS_SIGNING_SECRET?.trim();
  if (!signingSecret) return null;
  return createHmac('sha256', signingSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

export async function saveCredentials(formData: FormData) {
  const session = await auth();
  if (!session) {
    redirect('/login' as Route);
  }

  if (!process.env.INSTANCE_WEB_URL) {
    redirect('/credentials?error=missing-instance-url' as Route);
  }
  const instanceWebUrl = new URL(`https://${process.env.INSTANCE_WEB_URL}`);

  const parsed = saveCredentialsSchema.safeParse({
    accessToken: formData.get('accessToken'),
    secretKey: formData.get('secretKey'),
  });

  if (!parsed.success) {
    const field = z.treeifyError(parsed.error).properties;
    if (field?.accessToken?.errors[0]) {
      redirect('/credentials?error=missing-access-token' as Route);
    }
    redirect('/credentials?error=missing-secret-key' as Route);
  }

  try {
    if (!process.env.PLUTO_URL) {
      redirect('/credentials?error=missing-env-variable' as Route);
    }

    const url = new URL(process.env.PLUTO_URL);

    const timestamp = Date.now().toString();
    const rawBody = JSON.stringify({
      projectUrl: instanceWebUrl,
      mpAccessToken: parsed.data.accessToken,
      mpSecretKey: parsed.data.secretKey,
      redeploy: true,
    });
    const signature = signPayload(timestamp, rawBody);

    const response = await fetch(url.toString(), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'x-timestamp': timestamp,
        ...(signature ? { 'x-signature': `sha256=${signature}` } : {}),
      },
      body: rawBody,
    });

    if (!response.ok) {
      redirect('/credentials?error=save-failed' as Route);
    }
  } catch {
    redirect('/credentials?error=save-failed' as Route);
  }

  redirect(
    `/credentials/wait?next=${encodeURIComponent(getDefaultPathByRole(session.user.role) as Route)}`,
  );
}
