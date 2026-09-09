'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import TenantColorFields from '@/app/control/(protected)/tenants/color-fields';
import TenantFaviconField from '@/app/control/(protected)/tenants/favicon-field';
import {
  checkSubdomainAvailability,
  createTenant,
  type SubdomainAvailability,
  type TenantFormState,
  type TenantFormValues,
} from '@/app/control/(protected)/tenants/new/action';
import { CredentialsModal } from '@/components/admin/users/CredentialsModal';
import PhoneInputWithLabel from '@/components/common/PhoneInputWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import 'react-phone-number-input/style.css';

const emptyValues: TenantFormValues = {
  customId: '',
  name: '',
  comments: '',
  slug: '',
  description: '',
  contactEmail: '',
  faviconUrl: '',
  hue: '200',
  saturation: '100',
  adminFullName: '',
  adminEmail: '',
  adminUsername: '',
  adminPassword: '',
  adminDni: '',
  adminPhoneNumber: '',
  adminBirthDate: '',
  adminGender: '',
};

export default function TenantForm({
  initialValues,
  rootDomain,
}: {
  initialValues?: Partial<TenantFormValues>;
  rootDomain: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<TenantFormState, FormData>(
    createTenant,
    {},
  );
  const values = { ...emptyValues, ...initialValues, ...state.values };
  const retrying = Boolean(values.tenantId);
  const [slug, setSlug] = useState(values.slug);
  const [adminPhoneNumber, setAdminPhoneNumber] = useState(
    values.adminPhoneNumber,
  );
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
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

  useEffect(() => {
    if (state.credentials) setCredentialsModalOpen(true);
  }, [state.credentials]);

  function handleCredentialsModalChange(open: boolean) {
    setCredentialsModalOpen(open);
    if (!open) router.push('/');
  }

  return (
    <>
      <form action={action} className='space-y-8'>
        {values.tenantId && (
          <input type='hidden' name='tenantId' value={values.tenantId} />
        )}

        <fieldset className='grid gap-5 rounded-xl border border-stroke bg-white p-6 md:grid-cols-2'>
          <legend className='px-2 text-lg font-semibold'>Plataforma</legend>

          <FormField
            label='ID personalizable'
            name='customId'
            inputMode='numeric'
            pattern='[0-9]*'
            defaultValue={values.customId}
            error={state.errors?.customId}
          />
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
                <span className='pr-3 text-sm text-gray-500'>
                  .{rootDomain}
                </span>
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
            <Label htmlFor='comments'>Comentarios</Label>
            <Textarea
              id='comments'
              name='comments'
              defaultValue={values.comments}
              aria-invalid={Boolean(state.errors?.comments)}
              placeholder='Notas internas sobre la plataforma'
              className='min-h-28'
            />
            <FieldError message={state.errors?.comments} />
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
            slug={slug}
          />

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
            label='DNI/Pasaporte'
            name='adminDni'
            defaultValue={values.adminDni}
            error={state.errors?.adminDni}
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
          <PhoneInputWithLabel
            label='Número de teléfono'
            id='adminPhoneNumber'
            name='adminPhoneNumber'
            defaultCountry='AR'
            value={adminPhoneNumber}
            onChange={(value) => setAdminPhoneNumber(value ?? '')}
            error={state.errors?.adminPhoneNumber}
          />
          <FormField
            label='Fecha de nacimiento'
            name='adminBirthDate'
            type='date'
            defaultValue={values.adminBirthDate}
            error={state.errors?.adminBirthDate}
          />
          <SelectWithLabel
            label='Género'
            id='adminGender'
            name='adminGender'
            defaultValue={values.adminGender || undefined}
            className='w-full'
            values={[
              { label: 'Masculino', value: 'male' },
              { label: 'Femenino', value: 'female' },
              { label: 'Otro', value: 'other' },
            ]}
            error={state.errors?.adminGender}
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
          <Button type='submit' disabled={pending}>
            {pending
              ? 'Preparando plataforma...'
              : retrying
                ? 'Reintentar creación'
                : 'Crear plataforma'}
          </Button>
        </div>
      </form>

      {state.credentials && (
        <CredentialsModal
          credentials={state.credentials}
          type='platform'
          loginUrl={getTenantLoginUrl(state.credentials.slug, rootDomain)}
          open={credentialsModalOpen}
          onOpenChange={handleCredentialsModalChange}
        />
      )}
    </>
  );
}

function getTenantLoginUrl(slug: string, rootDomain: string) {
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${window.location.protocol}//${slug}.${rootDomain}${port}/login`;
}

function FormField({
  label,
  name,
  error,
  type,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  name: keyof TenantFormValues;
  error?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className='space-y-1'>
      <Label htmlFor={name}>{label}</Label>
      <div className='relative'>
        <Input
          id={name}
          name={name}
          type={isPassword && showPassword ? 'text' : type}
          className={isPassword ? 'pr-10' : undefined}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {isPassword && (
          <button
            type='button'
            onClick={() => setShowPassword((visible) => !visible)}
            className='absolute top-1/2 right-2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
            aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        )}
      </div>
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className='text-xs font-medium text-red-600'>{message}</p>
  ) : null;
}
