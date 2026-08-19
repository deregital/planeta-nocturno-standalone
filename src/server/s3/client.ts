import 'server-only';

import { S3Client } from '@aws-sdk/client-s3';

export const S3_BUCKET_NAME = 'planeta-nocturno';

let s3Client: S3Client | undefined;

export function getS3Client() {
  s3Client ??= new S3Client({
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    region: process.env.AWS_REGION!,
  });

  return s3Client;
}
