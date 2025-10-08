'use client';

import { Loader } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';

import { handleUpdate } from '@/app/admin/settings/action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FEATURE_KEYS } from '@/server/constants/feature-keys';
import { trpc } from '@/server/trpc/client';

const FEATURE_CONFIG = {
  [FEATURE_KEYS.DATATABLE_EXPORT]: {
    label: 'Exportar tablas a Excel',
    valueType: '',
  },
  [FEATURE_KEYS.EMAIL_NOTIFICATION]: {
    label: 'Recibir notificaciones de entradas emitidas',
    valueType: '',
  },
  [FEATURE_KEYS.SERVICE_FEE]: {
    label: 'Cargo por servicio %',
    valueType: 'number',
  },
};

export default function Page() {
  const [state, action, isPending] = useActionState(handleUpdate, {
    success: false,
  });

  const { data: features, isLoading } = trpc.feature.getAll.useQuery();

  useEffect(() => {
    if (state.success) {
      toast.success('Se han actualizado las configuraciones');
    } else if (state.errors) {
      toast.error('Hubo un error al actualizar las configuraciones');
    }
  }, [state]);

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
            <div className='flex items-center gap-4'>
              <Label
                htmlFor={`${featureKey}-enabled`}
                className='text-lg font-medium'
              >
                {config.label}
              </Label>
              {config.valueType && (
                <Input
                  id={`${featureKey}-value`}
                  name={`${featureKey}-value`}
                  type={config.valueType}
                  defaultValue={
                    state.formData?.[index].value ?? feature?.value ?? ''
                  }
                  className='w-24'
                />
              )}
              <Switch
                className='h-6 w-10 [&_[data-slot=switch-thumb]]:size-5'
                id={`${featureKey}-enabled`}
                name={`${featureKey}-enabled`}
                defaultChecked={feature?.enabled ?? false}
              />
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
