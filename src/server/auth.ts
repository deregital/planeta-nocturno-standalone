import { compare } from 'bcrypt';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import NextAuth, { CredentialsSignin, type Session } from 'next-auth';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { cache } from 'react';
import { z } from 'zod';

import { getControlDb } from '@/db/control/client';
import { controlAdmins } from '@/db/control/schema';
import { user as userTable } from '@/drizzle/schema';
import {
  isControlSessionValid,
  isTenantSessionValid,
} from '@/lib/auth/session-tenant';
import { isControlRequest } from '@/server/control/is-control-request';
import {
  getCurrentRequestContext,
  resolveRequestContext,
} from '@/server/instance/resolve-request-context';
import { logger } from '@/server/observability/logger';
import {
  CONTROL_LOGIN_ATTEMPTS,
  loginLockedMinutes,
  registerFailedLogin,
  registerSuccessfulLogin,
  TENANT_LOGIN_ATTEMPTS,
} from '@/server/security/login-throttle';

// Sin el mínimo de largo de las altas: hay contraseñas viejas más cortas.
const credentialsSchema = z.object({
  name: z.string().trim().min(1),
  password: z.string().min(1),
});

// Un solo mensaje: con 'Usuario no encontrado' y 'Contraseña incorrecta' se
// podía averiguar qué usuarios existen.
const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos';

// Si el usuario no existe se compara contra este hash igual, para que el
// tiempo de respuesta tampoco lo delate.
const TIMING_DUMMY_HASH =
  '$2b$10$hZLkP4azJ.3FhNVxZCVTqehulT6NDHbKx1B9EyibrmLg1raGehabK';

async function passwordMatches(password: string, hash: string | undefined) {
  const ok = await compare(password, hash ?? TIMING_DUMMY_HASH);
  return ok && hash !== undefined;
}

function tooManyAttempts(minutes: number) {
  return new CustomError(
    `Demasiados intentos fallidos. Probá de nuevo en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`,
  );
}

const nextAuth = NextAuth({
  providers: [
    {
      type: 'credentials',
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: {
          label: 'Username',
          type: 'text',
          placeholder: 'Nombre de usuario',
        },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials, request) => {
        const { name, password } = credentialsSchema.parse(credentials);

        if (isControlRequest(request.headers)) {
          const controlDb = getControlDb();
          const locked = await loginLockedMinutes(
            controlDb,
            CONTROL_LOGIN_ATTEMPTS,
            name,
          );
          if (locked) throw tooManyAttempts(locked);

          const admin = await controlDb.query.controlAdmins.findFirst({
            where: eq(controlAdmins.username, name),
          });
          if (!(await passwordMatches(password, admin?.password)) || !admin) {
            await registerFailedLogin(controlDb, CONTROL_LOGIN_ATTEMPTS, name);
            throw new CustomError(INVALID_CREDENTIALS);
          }
          await registerSuccessfulLogin(
            controlDb,
            CONTROL_LOGIN_ATTEMPTS,
            name,
          );

          return {
            id: admin.id,
            name: admin.username,
            email: admin.email,
            emailVerified: null,
            role: 'CONTROL_ADMIN',
            tenantSlug: null,
            fullName: admin.username,
            image: null,
          };
        }

        const { db, instance } = await resolveRequestContext(request.headers);
        const locked = await loginLockedMinutes(
          db,
          TENANT_LOGIN_ATTEMPTS,
          name,
        );
        if (locked) throw tooManyAttempts(locked);

        const user = await db.query.user.findFirst({
          where: eq(userTable.name, name),
        });
        if (!(await passwordMatches(password, user?.password)) || !user) {
          await registerFailedLogin(db, TENANT_LOGIN_ATTEMPTS, name);
          throw new CustomError(INVALID_CREDENTIALS);
        }
        await registerSuccessfulLogin(db, TENANT_LOGIN_ATTEMPTS, name);
        return {
          ...user,
          tenantSlug: instance.slug,
          emailVerified: user.emailVerified
            ? new Date(user.emailVerified)
            : null,
        };
      },
    },
  ],
  callbacks: {
    async session({ session, token, user }) {
      if (user) {
        session.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          role: user.role,
          tenantSlug: user.tenantSlug,
          fullName: user.fullName,
          image: user.image,
        };
      } else {
        session.user = {
          id: token.sub as string,
          name: token.name as string,
          email: token.email as string,
          emailVerified: token.emailVerified as Date | null,
          role: token.role as Session['user']['role'],
          tenantSlug:
            typeof token.tenantSlug === 'string' ? token.tenantSlug : null,
          fullName: token.fullName as string,
          image: token.image as string | null,
        };
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.tenantSlug = user.tenantSlug;
        token.fullName = user.fullName;
        token.image = user.image;
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
});

export const { handlers, signIn, signOut } = nextAuth;
export const authMiddleware = nextAuth.auth;

export async function getSessionForInstance(tenantSlug: string | null) {
  const session = await nextAuth.auth();
  return isTenantSessionValid(session, tenantSlug) ? session : null;
}

async function controlAdminExists(adminId: string) {
  const [admin] = await getControlDb()
    .select({ id: controlAdmins.id })
    .from(controlAdmins)
    .where(eq(controlAdmins.id, adminId))
    .limit(1);
  return Boolean(admin);
}

/** Escribe como máximo una vez cada 5 minutos por admin, fuera del tiempo de respuesta. */
const touchControlAdminLastSeen = cache((adminId: string) => {
  after(async () => {
    try {
      await getControlDb()
        .update(controlAdmins)
        .set({ lastSeenAt: sql`now()` })
        .where(
          and(
            eq(controlAdmins.id, adminId),
            or(
              isNull(controlAdmins.lastSeenAt),
              lt(controlAdmins.lastSeenAt, sql`now() - interval '5 minutes'`),
            ),
          ),
        );
    } catch (error) {
      logger.error('Unable to update control admin last seen', {
        adminId,
        error,
      });
    }
  });
});

/**
 * El JWT de control apunta a un admin que ya no existe. Quien llama redirige a
 * /session-expired, que cierra la sesión (en el render no se pueden borrar cookies).
 */
export async function hasStaleControlSession() {
  const rawSession = await nextAuth.auth();
  if (!rawSession || !isControlSessionValid(rawSession)) return false;
  return !(await controlAdminExists(rawSession.user.id));
}

/** Memoizada por request: layouts y páginas la llaman varias veces por render. */
export const auth = cache(async () => {
  const session = await nextAuth.auth();
  if (!session) return null;

  const requestHeaders = new Headers(await headers());
  if (isControlRequest(requestHeaders)) {
    if (!isControlSessionValid(session)) return null;
    if (!(await controlAdminExists(session.user.id))) return null;
    touchControlAdminLastSeen(session.user.id);
    return session;
  }

  try {
    const { instance } = await getCurrentRequestContext();
    return isTenantSessionValid(session, instance.slug) ? session : null;
  } catch {
    return null;
  }
});

export class CustomError extends CredentialsSignin {
  code = CustomError.CUSTOM_ERROR_CODE;
  static CUSTOM_ERROR_CODE = Symbol('CUSTOM_ERROR_CODE').toString();
  constructor(msg: string) {
    super();
    this.message = msg;
  }
}
