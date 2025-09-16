'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { signIn } from '@/server/auth';
import { trpc } from '@/server/trpc/server';

const loginSchema = z.object({
  username: z.string().min(1, 'El nombre de usuario es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginActionState = {
  username?: string;
  password?: string;
  errors?: {
    username?: string;
    password?: string;
    general?: string;
  };
};

export async function authenticate(
  prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const rawData: z.infer<typeof loginSchema> = {
    username: formData.get('username') as string,
    password: formData.get('password') as string,
  };
  try {
    const validatedData = loginSchema.safeParse(rawData);

    if (!validatedData.success) {
      return {
        ...rawData,
        errors: {
          username: z.treeifyError(validatedData.error).properties?.username
            ?.errors[0],
          password: z.treeifyError(validatedData.error).properties?.password
            ?.errors[0],
        },
      };
    }

    await signIn('credentials', {
      username: validatedData.data.username,
      password: validatedData.data.password,
      redirect: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return {
      ...rawData,
      errors: {
        general: err.message,
      },
    };
  }

  const user = await trpc.user.getByName(rawData.username);

  if (user?.role === 'TICKETING') {
    redirect('/admin/event');
  } else {
    redirect('/admin');
  }
}
