'use client';

import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { handleUpdate } from '@/app/(backoffice)/admin/settings/action';
import { InputFromSchema } from '@/components/admin/config/InputFromSchema';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  FEATURE_CONFIG,
  FEATURE_KEYS,
  type FeatureConfig,
  type FeatureKey,
} from '@/server/constants/feature-keys';
import { trpc } from '@/server/trpc/client';

type FeatureDraft = {
  enabled: boolean;
  value: string;
};

function buildDrafts(
  features: { key: string; enabled: boolean; value: string | null }[],
): Record<FeatureKey, FeatureDraft> {
  return Object.values(FEATURE_KEYS).reduce(
    (acc, featureKey) => {
      const feature = features.find((f) => f.key === featureKey);
      acc[featureKey] = {
        enabled: feature?.enabled ?? false,
        value: feature?.value ?? '',
      };
      return acc;
    },
    {} as Record<FeatureKey, FeatureDraft>,
  );
}

export default function UpdateFeatures() {
  const [state, action, isPending] = useActionState(handleUpdate, {
    success: false,
  });

  const { data: features } = trpc.feature.getAll.useQuery();
  const utils = trpc.useUtils();
  const [drafts, setDrafts] = useState<Record<FeatureKey, FeatureDraft> | null>(
    null,
  );
  const [baseline, setBaseline] = useState<Record<
    FeatureKey,
    FeatureDraft
  > | null>(null);

  useEffect(() => {
    if (!features) return;
    const next = buildDrafts(features);
    setDrafts(next);
    setBaseline(next);
  }, [features]);

  useEffect(() => {
    if (state.success) {
      toast.success('Se han actualizado las configuraciones');
      utils.feature.getAll.invalidate();
    } else if (state.errors || state.globalError) {
      toast.error('Hubo un error al actualizar las configuraciones');
    }
  }, [state, utils]);

  if (!features || features.length === 0 || !drafts || !baseline) return null;

  const isDirty = Object.values(FEATURE_KEYS).some((featureKey) => {
    const draft = drafts[featureKey];
    const initial = baseline[featureKey];
    return draft.enabled !== initial.enabled || draft.value !== initial.value;
  });

  return (
    <form
      action={action}
      className='flex flex-col gap-6 rounded-md border border-stroke bg-accent-ultra-light p-6'
    >
      {Object.values(FEATURE_KEYS).map((featureKey, index) => {
        const typedKey = featureKey as FeatureKey;
        const configRaw = FEATURE_CONFIG[typedKey];
        if (!configRaw) return null;

        const config = configRaw as FeatureConfig;
        const draft = drafts[typedKey];
        const error = state.errors?.[index];

        return (
          <div key={typedKey} className='flex flex-col gap-2'>
            <div className='grid max-w-3xl grid-cols-3 gap-4'>
              <Label
                htmlFor={`${typedKey}-enabled`}
                className='col-span-2 text-lg font-medium'
              >
                {config.label}
              </Label>

              <div className='flex items-center justify-end gap-4'>
                <InputFromSchema
                  id={`${typedKey}-value`}
                  name={`${typedKey}-value`}
                  field={config.validator}
                  value={draft.value}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDrafts((prev) =>
                      prev
                        ? {
                            ...prev,
                            [typedKey]: { ...prev[typedKey], value },
                          }
                        : prev,
                    );
                  }}
                  className='w-24'
                />
                <Switch
                  className='h-6 w-10 **:data-[slot=switch-thumb]:size-5'
                  id={`${typedKey}-enabled`}
                  name={`${typedKey}-enabled`}
                  checked={draft.enabled}
                  onCheckedChange={(enabled) => {
                    setDrafts((prev) =>
                      prev
                        ? {
                            ...prev,
                            [typedKey]: { ...prev[typedKey], enabled },
                          }
                        : prev,
                    );
                  }}
                />
              </div>
            </div>
            {error?.value && (
              <p className='ml-4 text-sm font-bold text-red-500'>
                {error.value}
              </p>
            )}
          </div>
        );
      })}
      <Button type='submit' disabled={isPending || !isDirty} className='w-fit'>
        Actualizar
      </Button>
    </form>
  );
}
