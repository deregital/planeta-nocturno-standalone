import {
  createUploadRouteHandler,
  route,
  type Router,
} from 'better-upload/server';

import { auth } from '@/server/auth';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { getS3Client, S3_BUCKET_NAME } from '@/server/s3/client';
import { generateSlug } from '@/server/utils/utils';

const router: Router = {
  client: getS3Client(),
  bucketName: S3_BUCKET_NAME,
  routes: {
    eventImage: route({
      onBeforeUpload: async ({ file }) => {
        const user = await auth();
        if (!user) {
          throw new Error('Unauthorized');
        }

        const { instance } = await getCurrentRequestContext();
        const route = generateSlug(instance.name);
        const objectKey = `${route}/${file.name}`;
        return {
          objectKey,
        };
      },
      fileTypes: ['image/*'],
    }),
  },
};
export const { POST } = createUploadRouteHandler(router);
