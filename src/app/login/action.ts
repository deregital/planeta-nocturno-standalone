'use server';

import { type Route } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { auth, signIn } from '@/server/auth';
import { isControlRequest } from '@/server/control/is-control-request';
import { userSchema } from '@/server/schemas/user';
import { getDefaultPathByRole } from '@/server/utils/authRedirect';

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
  const controlRequest = isControlRequest(new Headers(await headers()));
  const rawData: z.infer<typeof loginSchema> = {
    name: (formData.get('username') as string)?.trim(),
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

  if (controlRequest) redirect('/');

  const session = await auth();
  const role = session?.user?.role;

  redirect(getDefaultPathByRole(role) as Route);
}
