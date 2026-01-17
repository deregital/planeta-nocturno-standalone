'use server';

import { revalidatePath } from 'next/cache';
import z from 'zod';

import { type UserData } from '@/components/admin/config/UserForm';
import { userSchema } from '@/server/schemas/user';
import { trpc } from '@/server/trpc/server';

export type UpdateProfileActionState = {
  data?: Omit<UserData, 'password' | 'role'>;
  errors?: Partial<
    Record<keyof Omit<UserData, 'password'> | 'general', string>
  >;
  success?: boolean;
};

export async function updateProfile(
  prevState: UpdateProfileActionState,
  formData: FormData,
): Promise<UpdateProfileActionState> {
  const fullName = formData.get('fullName') as string;
  const name = formData.get('username') as string;
  const email = formData.get('email') as string;
  const birthDate = formData.get('birthDate') as string;
  const dni = formData.get('dni') as string;
  const gender = formData.get('gender') as string;
  const phoneNumber = formData.get('phoneNumber') as string;
  const instagram = formData.get('instagram') as string;

  const data = {
    fullName,
    name,
    email,
    birthDate,
    dni,
    gender,
    phoneNumber,
    instagram,
  };

  // Validar sin password, role y chiefOrganizerId
  const validation = userSchema
    .omit({ password: true, role: true, chiefOrganizerId: true })
    .safeParse(data);

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
        name,
        email,
        birthDate,
        dni,
        gender,
        phoneNumber,
        instagram,
      },
      errors: {
        general: '',
        fullName: errors.fullName ?? '',
        name: errors.name ?? '',
        email: errors.email ?? '',
        birthDate: errors.birthDate ?? '',
        dni: errors.dni ?? '',
        gender: errors.gender ?? '',
        phoneNumber: errors.phoneNumber ?? '',
        instagram: errors.instagram ?? '',
      },
    };
  }

  try {
    await trpc.user.updateOwnProfile({
      ...validation.data,
      birthDate: birthDate,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error al actualizar perfil';
    return {
      data: {
        fullName,
        name,
        email,
        birthDate,
        dni,
        gender,
        phoneNumber,
        instagram,
      },
      errors: {
        general: errorMessage,
      },
    };
  }

  revalidatePath('/profile');
  return {
    data: validation.data,
    errors: {},
    success: true,
  };
}
