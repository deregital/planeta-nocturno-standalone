import 'server-only';

import type { CORSRule } from '@aws-sdk/client-s3';

import { GetBucketCorsCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';

import { normalizeRootDomain } from '@/lib/tenancy/host';
import { getS3Client, S3_BUCKET_NAME } from '@/server/s3/client';

export async function ensureTenantCorsOrigin(slug: string) {
  return ensureCorsOrigin(getTenantOrigin(slug));
}

export async function ensureControlCorsOrigin() {
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN ?? '');
  return ensureCorsOrigin(getOrigin(`admin.${rootDomain}`));
}

async function ensureCorsOrigin(origin: string) {
  const corsRules = await getCorsRules();

  if (
    corsRules.some((rule) =>
      rule.AllowedOrigins?.some(
        (allowedOrigin) => allowedOrigin === origin || allowedOrigin === '*',
      ),
    )
  ) {
    return;
  }

  const uploadRuleIndex = corsRules.findIndex((rule) =>
    rule.AllowedMethods?.some(
      (method) => method === 'PUT' || method === 'POST',
    ),
  );

  if (uploadRuleIndex === -1) {
    corsRules.push(createUploadCorsRule(origin));
  } else {
    const uploadRule = corsRules[uploadRuleIndex]!;
    corsRules[uploadRuleIndex] = {
      ...uploadRule,
      AllowedOrigins: [...(uploadRule.AllowedOrigins ?? []), origin],
    };
  }

  await getS3Client().send(
    new PutBucketCorsCommand({
      Bucket: S3_BUCKET_NAME,
      CORSConfiguration: { CORSRules: corsRules },
    }),
  );
}

function getTenantOrigin(slug: string) {
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN ?? '');
  return getOrigin(`${slug}.${rootDomain}`);
}

function getOrigin(hostname: string) {
  const protocol =
    hostname === 'localhost' || hostname.endsWith('.localhost')
      ? 'http'
      : 'https';
  return `${protocol}://${hostname}`;
}

async function getCorsRules() {
  try {
    const result = await getS3Client().send(
      new GetBucketCorsCommand({ Bucket: S3_BUCKET_NAME }),
    );
    return result.CORSRules ?? [];
  } catch (error) {
    if (isMissingCorsConfiguration(error)) return [];
    throw error;
  }
}

function createUploadCorsRule(origin: string): CORSRule {
  return {
    AllowedHeaders: ['*'],
    AllowedMethods: ['GET', 'PUT', 'POST'],
    AllowedOrigins: [origin],
    ExposeHeaders: ['ETag'],
  };
}

function isMissingCorsConfiguration(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'NoSuchCORSConfiguration'
  );
}
