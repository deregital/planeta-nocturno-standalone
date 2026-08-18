'use client';

import { useActionState } from 'react';

import {
  createTenant,
  type TenantFormState,
  type TenantFormValues,
} from '@/app/control/(protected)/tenants/new/action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const emptyValues: TenantFormValues = {
  name: '',
  slug: '',
  description: '',
  contactEmail: '',
  faviconUrl: '',
  hue: '200',
  saturation: '100',
  plan: 'free',
  adminFullName: '',
  adminEmail: '',
  adminBirthDate: '',
  adminPhoneNumber: '',
  adminDni: '',
  adminGender: 'other',
  adminUsername: '',
  adminPassword: '',
};

export default function TenantForm({
  initialValues,
}: {
  initialValues?: Partial<TenantFormValues>;
}) {
  const [state, action, pending] = useActionState<TenantFormState, FormData>(
    createTenant,
    {},
  );
  const values = { ...emptyValues, ...initialValues, ...state.values };
  const retrying = Boolean(values.tenantId);

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
          label='Slug'
          name='slug'
          defaultValue={values.slug}
          error={state.errors?.slug}
          placeholder='nombre-del-espacio'
          readOnly={retrying}
          required
        />
        <FormField
          label='Email de contacto'
          name='contactEmail'
          type='email'
          defaultValue={values.contactEmail}
          error={state.errors?.contactEmail}
        />
        <FormField
          label='URL del ícono'
          name='faviconUrl'
          type='url'
          defaultValue={values.faviconUrl}
          error={state.errors?.faviconUrl}
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

        <FormField
          label='Tono'
          name='hue'
          type='number'
          min={0}
          max={360}
          defaultValue={values.hue}
          error={state.errors?.hue}
          required
        />
        <FormField
          label='Saturación'
          name='saturation'
          type='number'
          min={0}
          max={100}
          defaultValue={values.saturation}
          error={state.errors?.saturation}
          required
        />
        <SelectField
          label='Plan'
          name='plan'
          defaultValue={values.plan}
          error={state.errors?.plan}
          options={[
            { value: 'free', label: 'Free' },
            { value: 'pro', label: 'Pro' },
          ]}
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
          label='Fecha de nacimiento'
          name='adminBirthDate'
          type='date'
          defaultValue={values.adminBirthDate.slice(0, 10)}
          error={state.errors?.adminBirthDate}
          required
        />
        <FormField
          label='Teléfono'
          name='adminPhoneNumber'
          type='tel'
          defaultValue={values.adminPhoneNumber}
          error={state.errors?.adminPhoneNumber}
          placeholder='+549...'
        />
        <FormField
          label='DNI/Pasaporte'
          name='adminDni'
          defaultValue={values.adminDni}
          error={state.errors?.adminDni}
          required
        />
        <SelectField
          label='Género'
          name='adminGender'
          defaultValue={values.adminGender}
          error={state.errors?.adminGender}
          options={[
            { value: 'female', label: 'Femenino' },
            { value: 'male', label: 'Masculino' },
            { value: 'other', label: 'Otro' },
          ]}
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

function SelectField({
  label,
  name,
  defaultValue,
  error,
  options,
}: {
  label: string;
  name: keyof TenantFormValues;
  defaultValue: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className='space-y-1'>
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        className='border-stroke h-9 w-full rounded-md border bg-white px-3 text-sm aria-invalid:border-red-500'
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className='text-xs font-medium text-red-600'>{message}</p>
  ) : null;
}
