'use server';

import { auth } from '@/server/auth';
import { trpc } from '@/server/trpc/server';

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

  const isValid = await trpc.user.isPasswordValid({
    username: session.user.name,
    password,
  });

  if (!isValid) {
    return { ok: false, error: 'La contraseña es incorrecta' };
  }

  return { ok: true };
}
