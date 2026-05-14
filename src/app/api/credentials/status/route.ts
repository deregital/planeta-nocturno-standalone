import { NextResponse } from 'next/server';

import { signPayload } from '@/server/security/signed-request';

export async function GET() {
  if (!process.env.INSTANCE_WEB_URL) {
    return NextResponse.json(
      { success: false, message: 'Missing INSTANCE_WEB_URL' },
      { status: 500 },
    );
  }
  const instanceWebUrl = new URL(`https://${process.env.INSTANCE_WEB_URL}`);

  if (!process.env.PLUTO_URL) {
    return NextResponse.json(
      { success: false, message: 'Missing PLUTO_URL environment variable' },
      { status: 500 },
    );
  }
  const credentialsStatusUrl = new URL(
    `${process.env.PLUTO_URL}/api/credentials/status`,
  );

  try {
    const timestamp = Date.now().toString();
    const rawBody = JSON.stringify({ projectUrl: instanceWebUrl });
    const signature = signPayload(timestamp, rawBody);

    const response = await fetch(credentialsStatusUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'x-timestamp': timestamp,
        ...(signature ? { 'x-signature': `sha256=${signature}` } : {}),
      },
      body: rawBody,
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: 'Unable to fetch redeploy status' },
      { status: 502 },
    );
  }
}
