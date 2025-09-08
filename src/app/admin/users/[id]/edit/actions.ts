'use server';

import { redirect } from 'next/navigation';

import { trpc } from '@/server/trpc/server';
import { type role as roleEnum } from '@/drizzle/schema';
import { type User } from '@/server/types';

export async function updateUser(
  prevValues: Pick<
    User,
    'id' | 'fullName' | 'name' | 'email' | 'role' | 'password'
  >,
  formData: FormData,
) {
  const id = formData.get('id') as string;
  const fullName = formData.get('fullName') as string;
  const username = formData.get('username') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as (typeof roleEnum.enumValues)[number];
  const password = formData.get('password') as string;

  await trpc.user
    .update({
      id,
      username: username,
      email,
      fullName: fullName,
      role,
      password: password as string,
    })
    .catch((error) => {
      return {
        ...prevValues,
        errors: {
          general: error.message,
        },
      };
    })
    .then(() => {
      redirect('/admin/users');
    });

  return {
    id,
    fullName,
    name: username,
    email,
    role,
    password,
  };
}
