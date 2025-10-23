'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { signIn } from '@/server/auth';
import { trpc } from '@/server/trpc/server';
import { userSchema } from '@/server/schemas/user';

const loginSchema = userSchema.pick({ name: true, password: true });
type LoginActionState = {
  name?: string;
  password?: string;
  errors?: {
    name?: string;
    password?: string;
    general?: string;
  };
};

export async function authenticate(
  prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const rawData: z.infer<typeof loginSchema> = {
    name: formData.get('username') as string,
    password: formData.get('password') as string,
  };
  try {
    const validatedData = loginSchema.safeParse(rawData);

    if (!validatedData.success) {
      return {
        ...rawData,
        errors: {
          name: z.treeifyError(validatedData.error).properties?.name?.errors[0],
          password: z.treeifyError(validatedData.error).properties?.password
            ?.errors[0],
        },
      };
    }

    await signIn('credentials', {
      name: validatedData.data.name,
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

  const user = await trpc.user.getByName(rawData.name);

  if (user?.role === 'TICKETING') {
    redirect('/admin/event');
  } else {
    redirect('/admin');
  }
}
