import { createHmac, timingSafeEqual } from 'crypto';

import { NextResponse } from 'next/server';

const DEFAULT_SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

function unauthorizedResponse() {
  return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
}

function normalizeTimestamp(value: string): number | null {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  return raw < 1_000_000_000_000 ? raw * 1000 : raw;
}

function isValidSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  signatureHeader: string,
) {
  const expected = createHmac('sha256', signingSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const received = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader;

  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function signPayload(
  timestamp: string,
  rawBody: string,
  signingSecret = process.env.CREDENTIALS_SIGNING_SECRET?.trim(),
) {
  if (!signingSecret) return null;

  return createHmac('sha256', signingSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

type VerifySignedRequestOptions = {
  logPrefix: string;
  toleranceMs?: number;
};

type VerifySignedRequestResult =
  | {
      ok: true;
      rawBody: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function verifySignedRequest(
  request: Request,
  options: VerifySignedRequestOptions,
): Promise<VerifySignedRequestResult> {
  const { logPrefix, toleranceMs = DEFAULT_SIGNATURE_TOLERANCE_MS } = options;
  const signingSecret = process.env.CREDENTIALS_SIGNING_SECRET?.trim();

  if (!signingSecret) {
    console.error(`${logPrefix} Missing CREDENTIALS_SIGNING_SECRET`);
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'CREDENTIALS_SIGNING_SECRET is not configured' },
        { status: 500 },
      ),
    };
  }

  const signatureHeader = request.headers.get('x-signature')?.trim();
  const timestampHeader = request.headers.get('x-timestamp')?.trim();

  if (!signatureHeader || !timestampHeader) {
    console.warn(`${logPrefix} Missing signature or timestamp header`);
    return { ok: false, response: unauthorizedResponse() };
  }

  const normalizedTimestamp = normalizeTimestamp(timestampHeader);
  if (!normalizedTimestamp) {
    console.warn(`${logPrefix} Invalid timestamp format`, {
      timestampHeader,
    });
    return { ok: false, response: unauthorizedResponse() };
  }

  if (Math.abs(Date.now() - normalizedTimestamp) > toleranceMs) {
    console.warn(`${logPrefix} Timestamp outside tolerance window`, {
      timestampHeader,
      normalizedTimestamp,
    });
    return { ok: false, response: unauthorizedResponse() };
  }

  const rawBody = await request.text();
  if (
    !isValidSignature(signingSecret, timestampHeader, rawBody, signatureHeader)
  ) {
    console.warn(`${logPrefix} Invalid HMAC signature`, {
      timestampHeader,
    });
    return { ok: false, response: unauthorizedResponse() };
  }

  return { ok: true, rawBody };
}
