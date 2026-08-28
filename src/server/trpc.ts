import { type inferRouterOutputs, initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { z, ZodError } from 'zod';

import { type role as roleEnum } from '@/drizzle/schema';
import { isTenantSessionValid } from '@/lib/auth/session-tenant';
import { getSessionForInstance } from '@/server/auth';
import { resolveRequestContext } from '@/server/instance/resolve-request-context';
import { type appRouter } from '@/server/routers/app';

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
  const requestContext = await resolveRequestContext(opts.headers);
  const session = await getSessionForInstance(requestContext.instance.slug);

  return {
    session,
    ...requestContext,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const data: Record<string, unknown> = {
      ...shape.data,
      zodError:
        error.cause instanceof ZodError ? z.treeifyError(error.cause) : null,
    };

    // Si el cause tiene una propiedad errors, extraerla directamente
    if (error.cause && !(error.cause instanceof ZodError)) {
      const cause = error.cause as unknown;
      if (
        typeof cause === 'object' &&
        cause !== null &&
        'errors' in cause &&
        Array.isArray(cause.errors)
      ) {
        // Extraer los errores directamente al data
        data.errors = cause.errors;
      }
      // También incluir el cause completo por si acaso
      try {
        data.cause = superjson.deserialize(superjson.serialize(error.cause));
      } catch {
        data.cause = error.cause;
      }
    }

    return {
      ...shape,
      data,
    };
  },
});

const levelsOfAccess: (typeof roleEnum.enumValues)[number][] = [
  'ADMIN',
  'CHIEF_ORGANIZER',
  'ORGANIZER',
  'TICKETING',
  'CONTROL_TICKETING',
];

function genericProcedure(level: (typeof roleEnum.enumValues)[number]) {
  return t.procedure.use(({ ctx, next }) => {
    const session = ctx.session;

    if (!session || !session.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (session.user.role === 'CONTROL_ADMIN') {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!isTenantSessionValid(session, ctx.instance.slug)) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const adminIndex = levelsOfAccess.indexOf(level);
    const index = levelsOfAccess.indexOf(session.user.role);

    if (index > adminIndex) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    return next({
      ctx: {
        ...ctx,
        session: { ...session, user: session.user },
      },
    });
  });
}

export const adminProcedure = genericProcedure('ADMIN');

export const chiefOrganizerProcedure = genericProcedure('CHIEF_ORGANIZER');

export const organizerProcedure = genericProcedure('ORGANIZER');

export const ticketingProcedure = genericProcedure('TICKETING');

export const controlTicketingProcedure = genericProcedure('CONTROL_TICKETING');

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export type RouterOutput = inferRouterOutputs<typeof appRouter>;
