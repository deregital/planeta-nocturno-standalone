'use server';

import { revalidatePath } from 'next/cache';
import z from 'zod';

import {
  createLocationSchema,
  updateLocationSchema,
} from '@/server/schemas/location';
import { trpc } from '@/server/trpc/server';

export async function revalidateLocations() {
  revalidatePath('/admin/locations');
}

export type CreateLocationActionState = {
  name?: string;
  address?: string;
  googleMapsUrl?: string;
  capacity?: number;
  errors?: {
    name?: string[];
    address?: string[];
    googleMapsUrl?: string[];
    capacity?: string[];
  };
  success?: boolean;
};

export async function handleCreate(
  prevState: CreateLocationActionState,
  formData: FormData,
) {
  const rawData = {
    name: formData.get('name') as string,
    address: formData.get('address') as string,
    googleMapsUrl: formData.get('googleMapsUrl') as string,
    capacity: Number(formData.get('capacity')),
  };

  const validation = createLocationSchema.safeParse(rawData);

  if (!validation.success) {
    const validateErrors = z.treeifyError(validation.error).properties;

    return {
      ...rawData,
      success: false,
      errors: {
        name: validateErrors?.name?.errors,
        address: validateErrors?.address?.errors,
        googleMapsUrl: validateErrors?.googleMapsUrl?.errors,
        capacity: validateErrors?.capacity?.errors,
      },
    };
  }

  await trpc.location.create(rawData);

  revalidateLocations();

  return {
    success: true,
  };
}

export type UpdateLocationActionState = {
  id?: string;
  name?: string;
  address?: string;
  googleMapsUrl?: string;
  capacity?: number;
  errors?: {
    name?: string[];
    address?: string[];
    googleMapsUrl?: string[];
    capacity?: string[];
  };
  success?: boolean;
};

export async function handleUpdate(
  prevState: UpdateLocationActionState,
  formData: FormData,
) {
  const rawData = {
    id: formData.get('id') as string,
    name: formData.get('name') as string,
    address: formData.get('address') as string,
    googleMapsUrl: formData.get('googleMapsUrl') as string,
    capacity: Number(formData.get('capacity')),
  };

  const validation = updateLocationSchema.safeParse(rawData);

  if (!validation.success) {
    const validateErrors = z.treeifyError(validation.error).properties;

    return {
      ...rawData,
      success: false,
      errors: {
        name: validateErrors?.name?.errors,
        address: validateErrors?.address?.errors,
        googleMapsUrl: validateErrors?.googleMapsUrl?.errors,
        capacity: validateErrors?.capacity?.errors,
      },
    };
  }

  await trpc.location.update(rawData);

  revalidateLocations();

  return {
    ...rawData,
    success: true,
  };
}
