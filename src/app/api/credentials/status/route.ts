import { createHmac } from 'crypto';

import { NextResponse } from 'next/server';

const CREDENTIALS_STATUS_URL =
  process.env.CREDENTIALS_STATUS_URL ?? 'https://.../api/credentials/status'; // remove on prod

function signPayload(timestamp: string, rawBody: string) {
  const signingSecret = process.env.CREDENTIALS_SIGNING_SECRET?.trim();
  if (!signingSecret) return null;
  return createHmac('sha256', signingSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

export async function GET() {
  if (!process.env.INSTANCE_WEB_URL) {
    return NextResponse.json(
      { success: false, message: 'Missing INSTANCE_WEB_URL' },
      { status: 500 },
    );
  }
  const instanceWebUrl = new URL(`https://${process.env.INSTANCE_WEB_URL}`);

  try {
    const timestamp = Date.now().toString();
    const rawBody = JSON.stringify({ projectUrl: instanceWebUrl });
    const signature = signPayload(timestamp, rawBody);

    const response = await fetch(CREDENTIALS_STATUS_URL, {
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
