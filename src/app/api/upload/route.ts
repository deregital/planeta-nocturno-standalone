import { auth } from '@/server/auth';
import { generateSlug } from '@/server/utils/utils';
import { S3Client } from '@aws-sdk/client-s3';
import {
  createUploadRouteHandler,
  route,
  type Router,
} from 'better-upload/server';

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  region: process.env.AWS_REGION!,
});

const router: Router = {
  client: s3,
  bucketName: 'planeta-nocturno',
  routes: {
    eventImage: route({
      onBeforeUpload: async ({ file }) => {
        const user = await auth();
        if (!user) {
          throw new Error('Unauthorized');
        }

        const route = generateSlug(process.env.NEXT_PUBLIC_INSTANCE_NAME!);
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
