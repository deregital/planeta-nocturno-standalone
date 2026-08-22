'use client';

import { useActionState } from 'react';

import {
  type TenantEditState,
  type TenantEditValues,
  updateTenant,
} from '@/app/control/(protected)/tenants/[id]/action';
import TenantColorFields from '@/app/control/(protected)/tenants/color-fields';
import TenantFaviconField from '@/app/control/(protected)/tenants/favicon-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function TenantEditForm({
  initialValues,
  slug,
}: {
  initialValues: TenantEditValues;
  slug: string;
}) {
  const [state, action, pending] = useActionState<TenantEditState, FormData>(
    updateTenant,
    {},
  );
  const values = { ...initialValues, ...state.values };

  return (
    <form action={action} className='space-y-6'>
      <input type='hidden' name='tenantId' value={values.tenantId} />

      <fieldset className='grid gap-5 rounded-xl border border-stroke bg-white p-6 md:grid-cols-2'>
        <legend className='px-2 text-lg font-semibold'>Configuración</legend>

        <FormField
          label='Nombre'
          name='name'
          defaultValue={values.name}
          error={state.errors?.name}
          required
        />
        <FormField
          label='Email de contacto'
          name='contactEmail'
          type='email'
          defaultValue={values.contactEmail}
          error={state.errors?.contactEmail}
        />
        <div className='space-y-1 md:col-span-2'>
          <Label htmlFor='description'>Descripción</Label>
          <Textarea
            id='description'
            name='description'
            defaultValue={values.description}
            aria-invalid={Boolean(state.errors?.description)}
          />
          <FieldError message={state.errors?.description} />
        </div>
        <TenantFaviconField
          initialUrl={values.faviconUrl}
          error={state.errors?.faviconUrl}
          slug={slug}
        />
        <TenantColorFields
          initialHue={values.hue}
          initialSaturation={values.saturation}
          errors={state.errors}
        />
      </fieldset>

      {state.errors?.general && (
        <p className='rounded-md bg-red-50 p-3 text-sm font-medium text-red-700'>
          {state.errors.general}
        </p>
      )}

      <div className='flex justify-end'>
        <Button type='submit' disabled={pending}>
          {pending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

function FormField({
  label,
  name,
  error,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  name: keyof TenantEditValues;
  error?: string;
}) {
  return (
    <div className='space-y-1'>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} aria-invalid={Boolean(error)} {...props} />
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className='text-xs font-medium text-red-600'>{message}</p>
  ) : null;
}
