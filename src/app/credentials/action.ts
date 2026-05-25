'use server';

import { type Route } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/server/auth';
import { signPayload } from '@/server/security/signed-request';
import { getDefaultPathByRole } from '@/server/utils/authRedirect';

const MP_ACCESS_TOKEN_RE = /^APP_USR-\d+-\d+-[A-Za-z0-9]+-\d+$/;
const MP_SECRET_KEY_RE = /^[a-fA-F0-9]{64}$/;

export async function saveCredentials(formData: FormData) {
  const session = await auth();
  if (!session) {
    redirect('/login' as Route);
  }

  if (!process.env.INSTANCE_WEB_URL) {
    redirect('/credentials?error=missing-instance-url' as Route);
  }
  const instanceWebUrl = new URL(`https://${process.env.INSTANCE_WEB_URL}`);

  const accessToken = String(formData.get('accessToken') ?? '').trim();
  const secretKey = String(formData.get('secretKey') ?? '').trim();

  if (!accessToken) {
    redirect('/credentials?error=missing-access-token' as Route);
  }
  if (!secretKey) {
    redirect('/credentials?error=missing-secret-key' as Route);
  }
  if (!MP_ACCESS_TOKEN_RE.test(accessToken)) {
    redirect('/credentials?error=invalid-access-token' as Route);
  }
  if (!MP_SECRET_KEY_RE.test(secretKey)) {
    redirect('/credentials?error=invalid-secret-key' as Route);
  }

  try {
    if (!process.env.PLUTO_URL) {
      redirect('/credentials?error=missing-env-variable' as Route);
    }

    const url = new URL(`${process.env.PLUTO_URL}/api/credentials`);

    const timestamp = Date.now().toString();
    const rawBody = JSON.stringify({
      projectUrl: instanceWebUrl,
      mpAccessToken: accessToken,
      mpSecretKey: secretKey,
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
