'use server';

import z from 'zod';

import { userSchema } from '@/server/schemas/user';
import { trpc } from '@/server/trpc/server';

interface UpdateLinksState {
  data?: {
    mercadopago?: string;
    googleDriveUrl?: string;
  };
  errors?: {
    mercadopago?: string;
    googleDriveUrl?: string;
  };
  success?: boolean;
}

export async function updateLinks(
  prevState: UpdateLinksState,
  formData: FormData,
): Promise<UpdateLinksState> {
  const organizerId = formData.get('organizerId') as string;
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

  await trpc.user.partialUpdate({
    id: organizerId,
    mercadopago: validation.data.mercadopago,
    googleDriveUrl: validation.data.googleDriveUrl,
  });

  return {
    data: {
      mercadopago,
      googleDriveUrl,
    },
    success: true,
  };
}
