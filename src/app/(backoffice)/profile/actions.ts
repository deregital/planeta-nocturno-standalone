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
    .omit({
      password: true,
      role: true,
      chiefOrganizerId: true,
      mercadopago: true,
      googleDriveUrl: true,
    })
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

export type UpdateOwnLinksState = {
  data?: {
    mercadopago?: string;
    googleDriveUrl?: string;
  };
  errors?: {
    mercadopago?: string;
    googleDriveUrl?: string;
  };
  success?: boolean;
};

export async function updateOwnLinks(
  _prevState: UpdateOwnLinksState,
  formData: FormData,
): Promise<UpdateOwnLinksState> {
  const mercadopago = formData.get('mercadopago') as string;
  const googleDriveUrl = formData.get('googleDriveUrl') as string;

  const validation = userSchema
    .pick({
      mercadopago: true,
      googleDriveUrl: true,
    })
    .safeParse({
      mercadopago: mercadopago?.trim() || null,
      googleDriveUrl: googleDriveUrl?.trim() || null,
    });

  if (validation.error) {
    const errors = z.treeifyError(validation.error).properties;
    return {
      data: {
        mercadopago,
        googleDriveUrl,
      },
      errors: {
        mercadopago: errors?.mercadopago?.errors[0],
        googleDriveUrl: errors?.googleDriveUrl?.errors[0],
      },
    };
  }

  try {
    await trpc.user.updateOwnLinks({
      mercadopago: validation.data.mercadopago,
      googleDriveUrl: validation.data.googleDriveUrl,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error al guardar los enlaces';
    return {
      data: {
        mercadopago,
        googleDriveUrl,
      },
      errors: {
        mercadopago: errorMessage,
      },
    };
  }

  revalidatePath('/profile');
  return {
    data: {
      mercadopago,
      googleDriveUrl,
    },
    success: true,
  };
}
