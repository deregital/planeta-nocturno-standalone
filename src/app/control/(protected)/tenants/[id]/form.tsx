'use client';

import { useActionState, useEffect, useState } from 'react';

import {
  checkTenantSlugAvailability,
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
import { TENANT_SLUG_ALIAS_TTL_MINUTES } from '@/lib/tenancy/host';

export default function TenantEditForm({
  initialValues,
  rootDomain,
  hasDatabase,
}: {
  initialValues: TenantEditValues;
  rootDomain: string;
  hasDatabase: boolean;
}) {
  const [state, action, pending] = useActionState<TenantEditState, FormData>(
    updateTenant,
    {},
  );
  const values = { ...initialValues, ...state.values };
  const [slug, setSlug] = useState(values.slug);
  const [availability, setAvailability] = useState<{
    available: boolean | null;
    message: string;
  }>({ available: null, message: '' });
  const slugChanged = slug !== initialValues.slug;

  useEffect(() => {
    if (!slugChanged) return;

    let active = true;
    const timeout = setTimeout(async () => {
      const result = await checkTenantSlugAvailability(
        slug,
        initialValues.tenantId,
      );
      if (active) setAvailability(result);
    }, 400);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [slugChanged, slug, initialValues.tenantId]);

  return (
    <form action={action} className='space-y-6'>
      <input type='hidden' name='tenantId' value={values.tenantId} />

      <fieldset className='grid gap-5 rounded-xl border border-stroke bg-white p-6 md:grid-cols-2'>
        <legend className='px-2 text-lg font-semibold'>Configuración</legend>

        <div className='space-y-1 md:col-span-2'>
          <Label htmlFor='customId'>ID personalizable</Label>
          <Input
            id='customId'
            name='customId'
            inputMode='numeric'
            pattern='[0-9]*'
            defaultValue={values.customId}
            aria-invalid={Boolean(state.errors?.customId)}
            className='max-w-40'
          />
          <FieldError message={state.errors?.customId} />
        </div>
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
          <div className='flex items-center rounded-md border border-stroke bg-white focus-within:border-ring'>
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
              required
            />
            {rootDomain && (
              <span className='pr-3 text-sm text-gray-500'>.{rootDomain}</span>
            )}
          </div>
          <FieldError message={state.errors?.slug} />
          {!state.errors?.slug && slugChanged && availability.message && (
            <p
              className={`text-xs font-medium ${
                availability.available
                  ? 'text-green-600'
                  : availability.available === false
                    ? 'text-red-600'
                    : 'text-gray-500'
              }`}
            >
              {availability.message}
            </p>
          )}
          {slugChanged && hasDatabase && (
            <p className='rounded-md bg-amber-50 p-3 text-xs text-amber-800'>
              {initialValues.slug}.{rootDomain} va a redirigir a {slug || '…'}.
              {rootDomain} durante {TENANT_SLUG_ALIAS_TTL_MINUTES} minutos.
              Después deja de funcionar y queda libre para otras plataformas.
              Los usuarios van a tener que volver a iniciar sesión.
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
        <TenantFaviconField
          initialUrl={values.faviconUrl}
          error={state.errors?.faviconUrl}
          slug={initialValues.slug}
        />
        <TenantColorFields
          initialHue={values.hue}
          initialSaturation={values.saturation}
          errors={state.errors}
        />
      </fieldset>

      <section className='space-y-2 rounded-xl border border-stroke bg-white p-6'>
        <Label htmlFor='comments' className='text-lg font-semibold'>
          Comentarios
        </Label>
        <Textarea
          id='comments'
          name='comments'
          defaultValue={values.comments}
          aria-invalid={Boolean(state.errors?.comments)}
          placeholder='Notas internas sobre la plataforma'
          className='min-h-32'
        />
        <FieldError message={state.errors?.comments} />
      </section>

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
