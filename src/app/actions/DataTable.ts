'use server';

import { compare } from 'bcrypt';
import { eq } from 'drizzle-orm';

import { db } from '@/drizzle';

import { user as userTable } from '@/drizzle/schema';
import { auth } from '@/server/auth';

export type ValidatePasswordState = {
  ok: boolean;
  error?: string;
};

export async function validatePassword(
  _prevState: ValidatePasswordState,
  formData: FormData,
): Promise<ValidatePasswordState> {
  const password = String(formData.get('password') ?? '');
  const session = await auth();
  if (!session?.user?.name) {
    return {
      ok: false,
      error: 'No se encontró el usuario, inicie sesión para poder exportar',
    };
  }

  if (!password) {
    return { ok: false, error: 'Ingrese su contraseña' };
  }

  const user = await db.query.user.findFirst({
    where: eq(userTable.name, session.user.name),
    columns: { password: true },
  });

  if (!user || !(await compare(password, user.password))) {
    return { ok: false, error: 'La contraseña es incorrecta' };
  }

  return { ok: true };
}
