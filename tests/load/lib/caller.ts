import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import type { Db } from '@/drizzle';

import { loadUserAccess } from '@/server/rbac/access';
import { appRouter } from '@/server/routers/app';
import { createCallerFactory } from '@/server/trpc';

const createCaller = createCallerFactory(appRouter);

export const loadInstance: ResolvedInstance = {
  tenantId: null,
  slug: null,
  name: 'Load Test',
  publicUrl: 'http://localhost:3000',
  siteUrl: 'http://localhost:3000',
  contactEmail: null,
  description: null,
  faviconUrl: null,
  hue: 200,
  saturation: 100,
  mercadoPagoAccessToken: null,
  mercadoPagoRefreshToken: null,
  database: { url: 'unused' },
};

export type SessionUser = {
  id: string;
  role:
    | 'ADMIN'
    | 'CHIEF_ORGANIZER'
    | 'ORGANIZER'
    | 'TICKETING'
    | 'CONTROL_TICKETING';
};

/**
 * Caller del appRouter real con el mismo contexto que arma createTRPCContext.
 * El usuario tiene que existir en la base: los permisos salen de su rol de acceso.
 */
export function callerFor(db: Db, user: SessionUser | null = null) {
  const session = user
    ? {
        expires: new Date(Date.now() + 86_400_000).toISOString(),
        user: {
          id: user.id,
          role: user.role,
          name: user.id,
          email: `${user.id}@load.test`,
          fullName: user.id,
          tenantSlug: null,
          emailVerified: null,
          image: null,
        },
      }
    : null;

  let access: ReturnType<typeof loadUserAccess> | undefined;
  return createCaller({
    db,
    instance: loadInstance,
    session,
    headers: new Headers(),
    // Igual que createTRPCContext: permisos del rol de acceso, cargados una vez.
    getAccess: () =>
      user ? (access ??= loadUserAccess(db, user.id)) : Promise.resolve(null),
  } as never);
}
