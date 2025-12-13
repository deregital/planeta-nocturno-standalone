'use client';

import { useState } from 'react';
import esPhoneLocale from 'react-phone-number-input/locale/es';

import InputDateWithLabel from '@/components/common/InputDateWithLabel';
import InputWithLabel from '@/components/common/InputWithLabel';
import PhoneInputWithLabel from '@/components/common/PhoneInputWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { type User } from '@/server/types';
import 'react-phone-number-input/style.css';

export type OrganizerData = Pick<
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
  | 'chiefOrganizerId'
>;

const defaultState: OrganizerData = {
  fullName: '',
  name: '',
  email: '',
  role: 'ORGANIZER',
  password: '',
  birthDate: '',
  gender: 'male',
  phoneNumber: '',
  dni: '',
  instagram: '',
  chiefOrganizerId: '',
};

export function OrganizerForm({
  userId,
  initialState,
  errors,
  formAction,
  isPending,
  type,
  chiefOrganizerId,
}: {
  type: 'CREATE' | 'EDIT';
  userId?: string;
  initialState?: OrganizerData;
  errors?: Partial<Record<keyof OrganizerData | 'general', string>>;
  formAction: (formData: FormData) => void;
  isPending: boolean;
  chiefOrganizerId?: string;
}) {
  const [internalState, setInternalState] = useState<OrganizerData>(
    initialState ?? defaultState,
  );

  function handleChange<K extends keyof OrganizerData>(
    key: K,
    value: OrganizerData[K],
  ) {
    setInternalState((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      className='flex flex-col gap-4 max-h-[90vh] overflow-y-auto px-1'
      action={formAction}
    >
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
      <Separator className='border rounded-full border-accent-light' />
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
      {type === 'CREATE' && (
        <InputWithLabel
          required
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
      )}
      <input hidden readOnly name='chiefOrganizerId' value={chiefOrganizerId} />
      {errors?.general && (
        <p className='pl-1 font-bold text-xs text-red-500'>{errors?.general}</p>
      )}
      <Button type='submit' disabled={isPending}>
        Guardar
      </Button>
    </form>
  );
}
