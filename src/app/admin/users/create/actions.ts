'use server';

import { redirect } from 'next/navigation';
import z from 'zod';

import { trpc } from '@/server/trpc/server';
import { type User } from '@/server/types';
import { type role as roleEnum } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';

type UserData = Pick<User, 'fullName' | 'name' | 'email' | 'role' | 'password'>;

export type CreateUserActionState = {
  data?: UserData;
  errors?: Record<keyof UserData | 'general', string>;
};

export async function createUser(
  prevValues: CreateUserActionState,
  formData: FormData,
): Promise<CreateUserActionState> {
  const fullName = formData.get('fullName') as string;
  const username = formData.get('username') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as (typeof roleEnum.enumValues)[number];
  const password = formData.get('password') as string;

  const data = {
    fullName,
    username,
    email,
    role,
    password,
  };

  const validation = userSchema.safeParse(data);

  if (!validation.success) {
    const validateErrors = z.treeifyError(validation.error).properties;
    return {
      data: {
        ...data,
        name: username,
      },
      errors: {
        general: '',
        fullName: validateErrors?.fullName?.errors?.[0] ?? '',
        name: validateErrors?.username?.errors?.[0] ?? '',
        email: validateErrors?.email?.errors?.[0] ?? '',
        role: validateErrors?.role?.errors?.[0] ?? '',
        password: validateErrors?.password?.errors?.[0] ?? '',
      },
    };
  }

  await trpc.user.create(data).catch((error) => {
    return {
      data: {
        ...data,
        name: username,
      },
      errors: {
        general: error.message,
      },
    };
  });

  redirect('/admin/users');
}
