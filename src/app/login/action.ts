'use server';

import { redirect } from 'next/navigation';
import { signIn } from '@/server/auth';
import { z } from 'zod';

const loginSchema = z.object({
  name: z.string().min(1),
  password: z.string().min(1),
});

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
    name: formData.get('name') as string,
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
    console.log(err);
    return {
      errors: {
        general: err.message,
      },
    };
  }

  redirect('/admin');
}
