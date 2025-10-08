'use server';

import { revalidatePath } from 'next/cache';
import z from 'zod';

import { FEATURE_KEYS } from '@/server/constants/feature-keys';
import { updateFeaturesSchema } from '@/server/schemas/feature';
import { trpc } from '@/server/trpc/server';

export type UpdateFeaturesActionState = {
  formData?: {
    key: string;
    enabled: boolean;
    value?: string | null;
  }[];
  success?: boolean;
  errors?: {
    key: string;
    enabled: string;
    value: string;
  }[];
};

export async function handleUpdate(
  prevState: UpdateFeaturesActionState,
  formData: FormData,
): Promise<UpdateFeaturesActionState> {
  const rawData = Object.values(FEATURE_KEYS).map((featureKey) => {
    const enabled = formData.get(`${featureKey}-enabled`) === 'on';
    const valueInput = formData.get(`${featureKey}-value`);
    const value = valueInput ? String(valueInput) : null;

    return {
      key: featureKey,
      enabled,
      value,
    };
  });

  const validation = updateFeaturesSchema.safeParse(rawData);

  if (!validation.success) {
    const validateErrors = z.treeifyError(validation.error).items?.map((i) => ({
      key: i.properties?.key?.errors[0] ?? '',
      enabled: i.properties?.enabled?.errors[0] ?? '',
      value: i.properties?.value?.errors[0] ?? '',
    }));

    return {
      formData: rawData,
      errors: validateErrors,
    };
  }

  await trpc.feature.update(rawData);
  revalidatePath('/admin/settings');

  return {
    formData: rawData,
    success: true,
  };
}
