import { type inferRouterOutputs, initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { z, ZodError } from 'zod';

import { db } from '@/drizzle';

import { auth } from '@/server/auth';
import { type appRouter } from '@/server/routers/app';
import { type role as roleEnum } from '@/drizzle/schema';

export function handleError(error: {
  message: string[];
  statusCode: number;
  error: string;
}): TRPCError | undefined {
  const { message, statusCode, error: cause } = error;

  const messageString = Array.isArray(message) ? message[0] : message;
  const errorCode = statusCode as
    | 200
    | 400
    | 401
    | 403
    | 404
    | 408
    | 409
    | 412
    | 413
    | 405
    | 499
    | 500;

  if (errorCode === 200) {
    return;
  }

  const errorFromStatusCode = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    408: 'TIMEOUT',
    409: 'CONFLICT',
    412: 'PRECONDITION_FAILED',
    413: 'PAYLOAD_TOO_LARGE',
    405: 'METHOD_NOT_SUPPORTED',
    499: 'CLIENT_CLOSED_REQUEST',
    500: 'INTERNAL_SERVER_ERROR',
  } as const;

  const code =
    errorFromStatusCode[errorCode] || ('INTERNAL_SERVER_ERROR' as const);

  return new TRPCError({
    code,
    message: messageString,
    cause,
  });
}

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    session,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? z.treeifyError(error.cause) : null,
      },
    };
  },
});

const levelsOfAccess: (typeof roleEnum.enumValues)[number][] = [
  'ADMIN',
  'DOOR',
];

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  const session = ctx.session;

  if (!session || !session.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const adminIndex = levelsOfAccess.indexOf('ADMIN');
  const index = levelsOfAccess.indexOf(session.user.role);

  if (index > adminIndex) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      session: { ...session, user: session.user },
      db: db,
    },
  });
});

export const doorProcedure = t.procedure.use(({ ctx, next }) => {
  const session = ctx.session;

  if (!session || !session.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const doorIndex = levelsOfAccess.indexOf('DOOR');
  const index = levelsOfAccess.indexOf(session.user.role);
  if (index > doorIndex) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      session: { ...session, user: session.user },
      db: db,
    },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure.use(({ next }) => {
  return next({
    ctx: {
      fetch: fetch,
      db: db,
    },
  });
});
export const createCallerFactory = t.createCallerFactory;

export type RouterOutput = inferRouterOutputs<typeof appRouter>;
