'use server';

import { revalidatePath } from 'next/cache';
import z from 'zod';

import { type UserData } from '@/components/admin/config/UserForm';
import { type OrganizerData } from '@/components/admin/users/OrganizerForm';
import { type role as roleEnum } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';
import { trpc } from '@/server/trpc/server';

export type EditUserActionState = {
  data?: Omit<UserData, 'password' | 'chiefOrganizerId'>;
  errors?: Partial<
    Record<
      keyof Omit<UserData, 'password' | 'chiefOrganizerId'> | 'general',
      string
    >
  >;
  success?: boolean;
};

export type EditOrganizerActionState = {
  data?: Omit<OrganizerData, 'password' | 'chiefOrganizerId' | 'role'>;
  errors?: Partial<
    Record<
      | keyof Omit<OrganizerData, 'password' | 'chiefOrganizerId' | 'role'>
      | 'general',
      string
    >
  >;
  success?: boolean;
};

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
  const instagram = formData.get('instagram') as string;

  const data = {
    fullName,
    name: username,
    email,
    role,
    birthDate,
    dni,
    gender,
    phoneNumber,
    instagram,
  };

  const validation = userSchema
    .omit({ password: true, chiefOrganizerId: true })
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
        name: username,
        email,
        role,
        birthDate,
        dni,
        gender,
        phoneNumber,
        instagram,
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
        instagram: errors.instagram ?? '',
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
        role,
        birthDate,
        dni,
        gender,
        phoneNumber,
        instagram,
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
        instagram: '',
      },
    };
  }

  revalidatePath('/admin/users');
  return {
    data: validation.data,
    errors: {},
    success: true,
  };
}

export async function updateOrganizer(
  prevState: EditOrganizerActionState,
  formData: FormData,
): Promise<EditOrganizerActionState> {
  const id = formData.get('id') as string;
  const fullName = formData.get('fullName') as string;
  const username = formData.get('username') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as (typeof roleEnum.enumValues)[number];
  const birthDate = formData.get('birthDate') as string;
  const dni = formData.get('dni') as string;
  const gender = formData.get('gender') as string;
  const phoneNumber = formData.get('phoneNumber') as string;
  const instagram = formData.get('instagram') as string;

  const data = {
    fullName,
    name: username,
    email,
    role,
    birthDate,
    dni,
    gender,
    phoneNumber,
    instagram,
  };

  const validation = userSchema
    .omit({ password: true, chiefOrganizerId: true, role: true })
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
        name: username,
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
        name: errors.username ?? '',
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
    await trpc.user.update({
      ...validation.data,
      id,
      role: 'ORGANIZER',
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
        birthDate,
        dni,
        gender,
        phoneNumber,
        instagram,
      },
      errors: {
        general: errorMessage,
        fullName: '',
        name: '',
        email: '',
        birthDate: '',
        dni: '',
        gender: '',
        phoneNumber: '',
        instagram: '',
      },
    };
  }

  revalidatePath('/admin/users');
  revalidatePath('/organization/organizers');

  return {
    data: validation.data,
    errors: {},
    success: true,
  };
}
