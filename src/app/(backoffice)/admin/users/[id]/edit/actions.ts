'use server';

import { redirect } from 'next/navigation';
import z from 'zod';
import { revalidatePath } from 'next/cache';

import { trpc } from '@/server/trpc/server';
import { type role as roleEnum } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';
import { type CreateUserActionState } from '@/app/(backoffice)/admin/users/create/actions';

export type EditUserActionState = CreateUserActionState;

export async function updateUser(
  prevState: EditUserActionState,
  formData: FormData,
): Promise<EditUserActionState> {
  const id = formData.get('id') as string;
  const fullName = formData.get('fullName') as string;
  const username = formData.get('username') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as (typeof roleEnum.enumValues)[number];
  const birthDate = formData.get('birthDate') as string;
  const dni = formData.get('dni') as string;
  const gender = formData.get('gender') as string;
  const phoneNumber = formData.get('phoneNumber') as string;
  const password = formData.get('password') as string;

  const data = {
    fullName,
    name: username,
    email,
    role,
    birthDate,
    dni,
    gender,
    phoneNumber,
    password,
  };

  const validation = userSchema.omit({ password: true }).safeParse(data);
  if (!validation.success) {
    const validateErrors = z.treeifyError(validation.error).properties;
    const errors = Object.entries(validateErrors ?? {}).reduce(
      (acc, [key, value]) => {
        acc[key as keyof typeof data] = value.errors[0];
        return acc;
      },
      {} as Record<string, string>,
    );
    return {
      data: {
        fullName,
        name: username,
        email,
        role,
        password,
        birthDate,
        dni,
        gender,
        phoneNumber,
      },
      errors: {
        general: '',
        fullName: errors.fullName ?? '',
        name: errors.username ?? '',
        email: errors.email ?? '',
        role: errors.role ?? '',
        birthDate: errors.birthDate ?? '',
        dni: errors.dni ?? '',
        gender: errors.gender ?? '',
        phoneNumber: errors.phoneNumber ?? '',
      },
    };
  }
  try {
    await trpc.user.update({
      ...validation.data,
      id,
      birthDate: birthDate,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error al actualizar usuario';
    return {
      data: {
        fullName,
        name: username,
        email,
        password,
        role,
        birthDate,
        dni,
        gender,
        phoneNumber,
      },
      errors: {
        general: errorMessage,
        fullName: '',
        name: '',
        email: '',
        role: '',
        birthDate: '',
        dni: '',
        gender: '',
        phoneNumber: '',
      },
    };
  }

  revalidatePath('/admin/users');
  redirect('/admin/users');
}
