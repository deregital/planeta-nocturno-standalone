'use client';

import { Loader } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';

import { handleUpdate } from '@/app/(backoffice)/admin/settings/action';
import { InputFromSchema } from '@/components/admin/config/InputFromSchema';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FEATURE_CONFIG, FEATURE_KEYS } from '@/server/constants/feature-keys';
import { trpc } from '@/server/trpc/client';

export default function Page() {
  const [state, action, isPending] = useActionState(handleUpdate, {
    success: false,
  });

  const { data: features, isLoading } = trpc.feature.getAll.useQuery();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (state.success) {
      toast.success('Se han actualizado las configuraciones');
      utils.feature.getAll.invalidate();
    } else if (state.errors || state.globalError) {
      toast.error('Hubo un error al actualizar las configuraciones');
    }
  }, [state, utils]);

  return isLoading ? (
    <Loader className='animate-spin' />
  ) : (
    <form action={action} className='flex flex-col gap-6 p-6'>
      {Object.values(FEATURE_KEYS).map((featureKey, index) => {
        const config = FEATURE_CONFIG[featureKey];
        const feature = features?.find((f) => f.key === featureKey);
        const error = state.errors?.[index];

        return (
          <div key={featureKey} className='flex flex-col gap-2'>
            <div className='grid grid-cols-3 gap-4 max-w-3xl'>
              <Label
                htmlFor={`${featureKey}-enabled`}
                className='text-lg font-medium col-span-2'
              >
                {config.label}
              </Label>

              <div className='flex gap-4 justify-end items-center'>
                <InputFromSchema
                  id={`${featureKey}-value`}
                  name={`${featureKey}-value`}
                  field={config.validator}
                  defaultValue={
                    state.formData?.[index].value ?? feature?.value ?? ''
                  }
                  className='w-24'
                />
                <Switch
                  className='h-6 w-10 **:data-[slot=switch-thumb]:size-5'
                  id={`${featureKey}-enabled`}
                  name={`${featureKey}-enabled`}
                  defaultChecked={feature?.enabled ?? false}
                />
              </div>
            </div>
            {error?.value && (
              <p className='text-sm text-red-500 font-bold ml-4'>
                {error.value}
              </p>
            )}
          </div>
        );
      })}
      <Button type='submit' disabled={isPending} className='w-fit'>
        Actualizar
      </Button>
    </form>
  );
}
