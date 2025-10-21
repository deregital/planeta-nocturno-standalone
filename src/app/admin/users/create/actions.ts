'use server';

import { redirect } from 'next/navigation';
import z from 'zod';

import { trpc } from '@/server/trpc/server';
import { type role as roleEnum } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';
import { type UserData } from '@/components/admin/users/UserForm';

export type CreateUserActionState = {
  data?: UserData;
  errors?: Partial<Record<keyof UserData | 'general', string>>;
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
  const birthDate = formData.get('birthDate') as string;
  const dni = formData.get('dni') as string;
  const gender = formData.get('gender') as string;
  const phoneNumber = formData.get('phoneNumber') as string;

  const data = {
    fullName,
    username,
    email,
    role,
    password,
    birthDate,
    dni,
    gender,
    phoneNumber,
  };

  const validation = userSchema.safeParse(data);

  if (!validation.success) {
    const validateErrors = z.treeifyError(validation.error).properties;
    const errors = Object.entries(validateErrors ?? {}).reduce(
      (acc, [key, value]) => {
        acc[key as keyof UserData] = value.errors[0];
        return acc;
      },
      {} as Record<keyof UserData, string>,
    );
    return {
      data: {
        ...data,
        name: username,
      },
      errors: {
        general: '',
        ...errors,
      },
    };
  }

  try {
    await trpc.user.create({
      ...validation.data,
      birthDate: birthDate,
    });
  } catch (error) {
    console.error('ENACTION ERROR', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Error al crear usuario';
    return {
      data: {
        ...data,
        name: username,
      },
      errors: {
        general: errorMessage,
      },
    };
  }

  redirect('/admin/users');
}
