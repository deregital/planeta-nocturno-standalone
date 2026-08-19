'use client';

import { useActionState, useEffect, useState } from 'react';

import {
  checkSubdomainAvailability,
  createTenant,
  type SubdomainAvailability,
  type TenantFormState,
  type TenantFormValues,
} from '@/app/control/(protected)/tenants/new/action';
import TenantColorFields from '@/app/control/(protected)/tenants/color-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const emptyValues: TenantFormValues = {
  name: '',
  slug: '',
  description: '',
  contactEmail: '',
  hue: '200',
  saturation: '100',
  adminFullName: '',
  adminEmail: '',
  adminUsername: '',
  adminPassword: '',
};

export default function TenantForm({
  initialValues,
  rootDomain,
}: {
  initialValues?: Partial<TenantFormValues>;
  rootDomain: string;
}) {
  const [state, action, pending] = useActionState<TenantFormState, FormData>(
    createTenant,
    {},
  );
  const values = { ...emptyValues, ...initialValues, ...state.values };
  const retrying = Boolean(values.tenantId);
  const [slug, setSlug] = useState(values.slug);
  const [availability, setAvailability] = useState<
    SubdomainAvailability | { available: null; message: string }
  >({ available: null, message: '' });

  useEffect(() => {
    if (retrying || !slug) return;

    let active = true;
    const timeout = setTimeout(async () => {
      const result = await checkSubdomainAvailability(slug, values.tenantId);
      if (active) setAvailability(result);
    }, 400);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [retrying, slug, values.tenantId]);

  return (
    <form action={action} className='space-y-8'>
      {values.tenantId && (
        <input type='hidden' name='tenantId' value={values.tenantId} />
      )}

      <fieldset className='grid gap-5 rounded-xl border border-stroke bg-white p-6 md:grid-cols-2'>
        <legend className='px-2 text-lg font-semibold'>Tenant</legend>

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
          <Label htmlFor='slug'>Subdominio</Label>
          <div className='flex items-center rounded-md border border-stroke bg-white focus-within:border-ring aria-invalid:border-red-500'>
            <Input
              id='slug'
              name='slug'
              value={slug}
              onChange={(event) => {
                const value = event.target.value.toLowerCase();
                setSlug(value);
                setAvailability({
                  available: null,
                  message: value ? 'Comprobando disponibilidad...' : '',
                });
              }}
              className='border-0 shadow-none focus-visible:ring-0'
              aria-invalid={Boolean(state.errors?.slug)}
              placeholder='nombre-del-espacio'
              readOnly={retrying}
              required
            />
            {rootDomain && (
              <span className='pr-3 text-sm text-gray-500'>.{rootDomain}</span>
            )}
          </div>
          <FieldError message={state.errors?.slug} />
          {!state.errors?.slug && (retrying || availability.message) && (
            <p
              className={`text-xs font-medium ${
                retrying || availability.available
                  ? 'text-green-600'
                  : availability.available === false
                    ? 'text-red-600'
                    : 'text-gray-500'
              }`}
            >
              {retrying ? 'Subdominio actual' : availability.message}
            </p>
          )}
        </div>
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

        <TenantColorFields
          initialHue={values.hue}
          initialSaturation={values.saturation}
          errors={state.errors}
        />
      </fieldset>

      <fieldset className='grid gap-5 rounded-xl border border-stroke bg-white p-6 md:grid-cols-2'>
        <legend className='px-2 text-lg font-semibold'>
          Administrador inicial
        </legend>

        <FormField
          label='Nombre completo'
          name='adminFullName'
          defaultValue={values.adminFullName}
          error={state.errors?.adminFullName}
          required
        />
        <FormField
          label='Email'
          name='adminEmail'
          type='email'
          defaultValue={values.adminEmail}
          error={state.errors?.adminEmail}
          required
        />
        <FormField
          label='Nombre de usuario'
          name='adminUsername'
          defaultValue={values.adminUsername}
          error={state.errors?.adminUsername}
          required
        />
        <FormField
          label='Contraseña'
          name='adminPassword'
          type='password'
          error={state.errors?.adminPassword}
          required
        />
      </fieldset>

      {state.errors?.general && (
        <p className='rounded-md bg-red-50 p-3 text-sm font-medium text-red-700'>
          {state.errors.general}
        </p>
      )}

      <div className='flex items-center justify-end gap-4'>
        <p className='text-sm text-gray-500'>
          La creación y migración puede tardar unos segundos.
        </p>
        <Button type='submit' disabled={pending}>
          {pending
            ? 'Preparando tenant...'
            : retrying
              ? 'Reintentar creación'
              : 'Crear tenant'}
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
  name: keyof TenantFormValues;
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
