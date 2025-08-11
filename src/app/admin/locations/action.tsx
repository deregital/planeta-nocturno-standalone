'use server';

import { createLocationSchema } from '@/server/schemas/location';
import { trpc } from '@/server/trpc/server';
import { redirect } from 'next/navigation';
import z from 'zod';

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
      errors: {
        name: validateErrors?.name?.errors,
        address: validateErrors?.address?.errors,
        googleMapsUrl: validateErrors?.googleMapsUrl?.errors,
        capacity: validateErrors?.capacity?.errors,
      },
    };
  }

  await trpc.location.create(rawData);

  redirect('/admin/locations');
}
