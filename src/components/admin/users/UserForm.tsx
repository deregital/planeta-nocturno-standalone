'use client';

import { useState } from 'react';
import esPhoneLocale from 'react-phone-number-input/locale/es';

import InputDateWithLabel from '@/components/common/InputDateWithLabel';
import InputWithLabel from '@/components/common/InputWithLabel';
import PhoneInputWithLabel from '@/components/common/PhoneInputWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { Button } from '@/components/ui/button';
import { role } from '@/drizzle/schema';
import { roleTranslation } from '@/lib/translations';
import { type User } from '@/server/types';
import 'react-phone-number-input/style.css';

export type UserData = Pick<
  User,
  | 'fullName'
  | 'name'
  | 'email'
  | 'role'
  | 'password'
  | 'birthDate'
  | 'dni'
  | 'gender'
  | 'phoneNumber'
  | 'instagram'
>;

const defaultState: UserData = {
  fullName: '',
  name: '',
  email: '',
  role: 'ADMIN',
  password: '',
  birthDate: '',
  gender: 'male',
  phoneNumber: '',
  dni: '',
  instagram: '',
};

export function UserForm({
  userId,
  initialState,
  errors,
  formAction,
  isPending,
  type,
}: {
  type: 'CREATE' | 'EDIT';
  userId?: string;
  initialState?: UserData;
  errors?: Partial<Record<keyof UserData | 'general', string>>;
  formAction: (formData: FormData) => void;
  isPending: boolean;
}) {
  const [internalState, setInternalState] = useState<UserData>(
    initialState ?? defaultState,
  );

  function handleChange<K extends keyof UserData>(key: K, value: UserData[K]) {
    setInternalState((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form className='flex flex-col gap-4' action={formAction}>
      {userId && <input type='hidden' name='id' value={userId} />}
      <InputWithLabel
        required
        label='Nombre'
        id='fullName'
        name='fullName'
        value={internalState?.fullName}
        error={errors?.fullName}
        onChange={(e) => {
          handleChange('fullName', e.target.value);
        }}
      />
      <InputWithLabel
        required
        label='Nombre de usuario'
        id='username'
        name='username'
        value={internalState?.name}
        error={errors?.name}
        onChange={(e) => {
          handleChange('name', e.target.value);
        }}
      />
      <InputWithLabel
        label='Email'
        required
        id='email'
        name='email'
        type='email'
        value={internalState?.email}
        error={errors?.email}
        onChange={(e) => {
          handleChange('email', e.target.value);
        }}
      />
      <InputDateWithLabel
        label='Fecha de nacimiento'
        id='birthDate'
        name='birthDate'
        error={errors?.birthDate}
        selected={
          internalState?.birthDate
            ? new Date(internalState.birthDate)
            : undefined
        }
        onChange={(date) => {
          handleChange('birthDate', date.toISOString());
        }}
      />
      <SelectWithLabel
        label='Rol'
        required
        id='role'
        name='role'
        value={internalState?.role}
        className='w-full'
        values={role.enumValues.map((roleValue) => ({
          label: roleTranslation[roleValue],
          value: roleValue,
        }))}
        error={errors?.role}
        onValueChange={(value) => {
          handleChange('role', value as (typeof role.enumValues)[number]);
        }}
      />
      <div>
        <PhoneInputWithLabel
          label='Número de teléfono'
          id='phoneNumber'
          labels={esPhoneLocale}
          defaultCountry='AR'
          value={internalState?.phoneNumber}
          error={errors?.phoneNumber}
          onChange={(value) => {
            handleChange('phoneNumber', value ?? '');
          }}
        />
        <input
          type='hidden'
          name='phoneNumber'
          value={internalState?.phoneNumber}
        />
      </div>
      <InputWithLabel
        label='DNI/Pasaporte'
        id='dni'
        name='dni'
        value={internalState?.dni}
        error={errors?.dni}
        onChange={(e) => {
          handleChange('dni', e.target.value);
        }}
        required
      />
      <SelectWithLabel
        label='Género'
        id='gender'
        name='gender'
        value={internalState?.gender}
        className='w-full'
        values={[
          { label: 'Masculino', value: 'male' },
          { label: 'Femenino', value: 'female' },
          { label: 'Otro', value: 'other' },
        ]}
        error={errors?.gender}
        onValueChange={(value) => {
          handleChange('gender', value as 'male' | 'female' | 'other');
        }}
        required
      />
      <InputWithLabel
        label='Instagram'
        id='instagram'
        name='instagram'
        value={internalState?.instagram ?? ''}
        error={errors?.instagram}
        onChange={(e) => {
          handleChange('instagram', e.target.value);
        }}
        placeholder='@'
      />
      <InputWithLabel
        required={type === 'CREATE'}
        disabled={type === 'EDIT'}
        label='Contraseña'
        id='password'
        type='password'
        name='password'
        value={internalState?.password}
        error={errors?.password}
        onChange={(e) => {
          handleChange('password', e.target.value);
        }}
      />
      {errors?.general && (
        <p className='pl-1 font-bold text-xs text-red-500'>{errors?.general}</p>
      )}
      <Button type='submit' disabled={isPending}>
        Guardar
      </Button>
    </form>
  );
}
