'use server';

import { revalidatePath } from 'next/cache';
import z from 'zod';

import { type UserData } from '@/components/admin/users/OrganizerForm';
import { type role as roleEnum } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';
import { trpc } from '@/server/trpc/server';

export type UserFirstTimeCredentials = {
  username: string;
  password: string;
  fullName: string;
  instagram: string | null;
  phoneNumber: string;
};

export type CreateUserActionState = {
  data?: UserData;
  errors?: Partial<Record<keyof UserData | 'general', string>>;
  credentials?: UserFirstTimeCredentials;
};

export async function createUser(
  prevValues: CreateUserActionState,
  formData: FormData,
): Promise<CreateUserActionState> {
  const fullName = formData.get('fullName') as string;
  const name = formData.get('username') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as (typeof roleEnum.enumValues)[number];
  const password = formData.get('password') as string;
  const birthDate = formData.get('birthDate') as string;
  const dni = formData.get('dni') as string;
  const gender = formData.get('gender') as string;
  const phoneNumber = formData.get('phoneNumber') as string;
  const instagram = formData.get('instagram') as string;

  const data = {
    fullName,
    name,
    email,
    role,
    password,
    birthDate,
    dni,
    gender,
    phoneNumber,
    instagram,
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
      data,
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
      data,
      errors: {
        general: errorMessage,
      },
    };
  }

  revalidatePath('/admin/users');

  return {
    credentials: {
      username: validation.data.name,
      password: validation.data.password,
      fullName: validation.data.fullName,
      instagram: validation.data.instagram,
      phoneNumber: validation.data.phoneNumber,
    },
  };
}

export async function createOrganizer(
  prevValues: CreateUserActionState,
  formData: FormData,
): Promise<CreateUserActionState> {
  const fullName = formData.get('fullName') as string;
  const name = formData.get('username') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const birthDate = formData.get('birthDate') as string;
  const dni = formData.get('dni') as string;
  const gender = formData.get('gender') as string;
  const phoneNumber = formData.get('phoneNumber') as string;
  const instagram = formData.get('instagram') as string;

  const data = {
    fullName,
    name,
    email,
    role: 'ORGANIZER' as (typeof roleEnum.enumValues)[number],
    password,
    birthDate,
    dni,
    gender,
    phoneNumber,
    instagram,
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
      data,
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
      data,
      errors: {
        general: errorMessage,
      },
    };
  }

  revalidatePath('/admin/config');

  return {
    credentials: {
      username: validation.data.name,
      password: validation.data.password,
      fullName: validation.data.fullName,
      instagram: validation.data.instagram,
      phoneNumber: validation.data.phoneNumber,
    },
  };
}
