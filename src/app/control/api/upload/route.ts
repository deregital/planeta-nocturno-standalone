import { randomUUID } from 'node:crypto';

import {
  createUploadRouteHandler,
  route,
  type Router,
} from 'better-upload/server';
import { z } from 'zod';

import { normalizeRootDomain } from '@/lib/tenancy/host';
import { canManageTenants } from '@/server/control/can-manage-tenants';
import { getS3Client, S3_BUCKET_NAME } from '@/server/s3/client';
import { ensureControlCorsOrigin } from '@/server/s3/ensure-tenant-cors-origin';
import { tenantSubdomainSchema } from '@/server/schemas/control-tenant';

const faviconExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

const router: Router = {
  client: getS3Client(),
  bucketName: S3_BUCKET_NAME,
  routes: {
    favicon: route({
      maxFileSize: 1024 * 1024,
      fileTypes: Object.keys(faviconExtensions),
      clientMetadataSchema: z.object({ slug: tenantSubdomainSchema }),
      onBeforeUpload: async ({ file, clientMetadata }) => {
        if (!(await canManageTenants())) throw new Error('Unauthorized');

        await ensureControlCorsOrigin();
        const extension = faviconExtensions[file.type];
        if (!extension) throw new Error('Tipo de logo inválido');
        const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN ?? '');
        const domain = `${clientMetadata.slug}.${rootDomain}`;

        return {
          objectKey: `${domain}/favicon/${randomUUID()}.${extension}`,
        };
      },
    }),
  },
};

export const { POST } = createUploadRouteHandler(router);
