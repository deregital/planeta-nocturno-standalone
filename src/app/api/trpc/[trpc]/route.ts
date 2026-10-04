import { type NextRequest } from 'next/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { logger } from '@/server/observability/logger';
import { appRouter } from '@/server/routers/app';
import { createContext } from '@/server/trpc/server';

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createContext,
    // tRPC atrapa los errores de los procedures, así que no llegan a
    // `onRequestError`. Sólo se loguean los inesperados (no validaciones).
    onError: ({ error, path, type }) => {
      if (error.code !== 'INTERNAL_SERVER_ERROR') return;
      logger.error('tRPC procedure failed', {
        'trpc.path': path,
        'trpc.type': type,
        error: error.cause ?? error,
      });
    },
  });

export { handler as GET, handler as POST };
