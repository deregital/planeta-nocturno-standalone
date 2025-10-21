'use server';

import { revalidatePath } from 'next/cache';

import {
  FEATURE_CONFIG,
  type FeatureKey,
} from '@/server/constants/feature-keys';
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
  globalError?: string;
};

export async function handleUpdate(
  prevState: UpdateFeaturesActionState,
  formData: FormData,
): Promise<UpdateFeaturesActionState> {
  try {
    const rawData = Object.entries(FEATURE_CONFIG).map(
      ([featureKey, featureConfig]) => {
        const enabled = formData.get(`${featureKey}-enabled`) === 'on';
        const valueInput = formData.get(`${featureKey}-value`);

        const validation = featureConfig.validator.safeParse(valueInput);

        if (!validation.success) {
          throw new Error(validation.error.message);
        }

        return {
          key: featureKey as FeatureKey,
          enabled,
          value: validation.data ? validation.data.toString() : null,
        };
      },
    );

    await trpc.feature.update(rawData);
    revalidatePath('/admin/settings');

    return {
      formData: rawData,
      success: true,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        formData: prevState.formData,
        success: false,
        globalError: error.message,
      };
    } else {
      return {
        formData: prevState.formData,
        success: false,
        globalError: 'Hubo un error en un campo del formulario',
      };
    }
  }
}
