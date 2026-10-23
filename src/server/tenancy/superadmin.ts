import 'server-only';

import { hash } from 'bcrypt';
import { and, eq, ne, or } from 'drizzle-orm';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';

import { user } from '@/drizzle/schema';
import { SUPERADMIN_ACCESS_ROLE_ID } from '@/lib/rbac/permissions';

export type SuperadminCredentials = {
  username: string;
  email: string;
  password: string;
  fullName: string;
};

const SUPERADMIN_DNI = 'SUPERADMIN';

/** Credenciales fijas del superadministrador que se crea en cada plataforma. */
export function getSuperadminCredentials(
  env: NodeJS.ProcessEnv = process.env,
): SuperadminCredentials {
  const username = env.TENANT_SYSTEM_ADMIN_USERNAME?.trim();
  const email = env.TENANT_SYSTEM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.TENANT_SYSTEM_ADMIN_PASSWORD;

  if (!username || !email || !password) {
    throw new Error(
      'TENANT_SYSTEM_ADMIN_USERNAME, TENANT_SYSTEM_ADMIN_EMAIL and TENANT_SYSTEM_ADMIN_PASSWORD are required',
    );
  }

  return {
    username,
    email,
    password,
    fullName: env.TENANT_SYSTEM_ADMIN_FULLNAME?.trim() || 'Superadministrador',
  };
}

/** Indica qué datos del administrador de la plataforma chocan con el superadministrador. */
export function getSuperadminConflicts(
  credentials: SuperadminCredentials,
  admin: { name: string; email: string; dni: string },
) {
  return {
    name:
      admin.name.trim().toLowerCase() === credentials.username.toLowerCase(),
    email: admin.email.trim().toLowerCase() === credentials.email,
    dni: admin.dni.trim().toUpperCase() === SUPERADMIN_DNI,
  };
}

/**
 * Crea el superadministrador de la plataforma o, si ya existe, vuelve a dejarle
 * el usuario y la contraseña fijos.
 */
export async function ensureTenantSuperadmin(
  db: NodePgDatabase,
  credentials: SuperadminCredentials,
) {
  const password = await hash(credentials.password, 10);
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.accessRoleId, SUPERADMIN_ACCESS_ROLE_ID))
    .limit(1);

  const [conflict] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(
      and(
        or(
          eq(user.name, credentials.username),
          eq(user.email, credentials.email),
          eq(user.dni, SUPERADMIN_DNI),
        ),
        existing ? ne(user.id, existing.id) : undefined,
      ),
    )
    .limit(1);

  if (conflict) {
    throw new Error(
      `Another user already uses the superadmin username, email or DNI (${conflict.name})`,
    );
  }

  const values = {
    name: credentials.username,
    email: credentials.email,
    fullName: credentials.fullName,
    password,
    role: 'ADMIN' as const,
    accessRoleId: SUPERADMIN_ACCESS_ROLE_ID,
  };

  if (existing) {
    await db.update(user).set(values).where(eq(user.id, existing.id));
    return { id: existing.id, created: false };
  }

  const [created] = await db
    .insert(user)
    .values({
      ...values,
      dni: SUPERADMIN_DNI,
      phoneNumber: '',
      gender: 'other',
      birthDate: '1900-01-01T00:00:00.000Z',
    })
    .returning({ id: user.id });

  return { id: created.id, created: true };
}
