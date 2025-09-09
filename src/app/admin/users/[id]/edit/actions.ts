'use server';

import { redirect } from 'next/navigation';
import z from 'zod';
import { revalidatePath } from 'next/cache';

import { trpc } from '@/server/trpc/server';
import { type role as roleEnum } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';
import { type CreateUserActionState } from '@/app/admin/users/create/actions';

export async function updateUser(
  prevState: CreateUserActionState,
  formData: FormData,
): Promise<CreateUserActionState> {
  const id = formData.get('id') as string;
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
  await trpc.user
    .update({
      ...data,
      id,
    })
    .catch((error) => {
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

  revalidatePath('/admin/users');
  redirect('/admin/users');
}
