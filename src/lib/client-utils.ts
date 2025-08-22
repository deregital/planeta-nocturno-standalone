'use client';

export function generateS3Url(objectKey: string): string {
  const bucketUrl = process.env.NEXT_PUBLIC_S3_BUCKET_URL;
  if (!bucketUrl) {
    throw new Error('S3_BUCKET_URL is not set');
  }
  return `${bucketUrl}/${objectKey}`;
}
