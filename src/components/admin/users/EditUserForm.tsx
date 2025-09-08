'use client';

import { useActionState } from 'react';

import InputWithLabel from '@/components/common/InputWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { Button } from '@/components/ui/button';
import { role } from '@/drizzle/schema';
import { type User } from '@/server/types';
import { updateUser } from '@/app/admin/users/[id]/edit/actions';

export function EditUserForm({
  user,
}: {
  user: Pick<User, 'id' | 'fullName' | 'name' | 'email' | 'role'>;
}) {
  const [state, handleSubmit, isPending] = useActionState(updateUser, {
    id: user.id,
    fullName: user.fullName,
    name: user.name,
    email: user.email,
    role: user.role,
    password: '',
  });
  const roles = role.enumValues;

  return (
    <form action={handleSubmit} className='flex flex-col gap-4'>
      <input type='hidden' name='id' value={user.id} />
      <InputWithLabel
        required
        label='Nombre'
        id='fullName'
        name='fullName'
        defaultValue={state.fullName}
      />
      <InputWithLabel
        required
        label='Nombre de usuario'
        id='username'
        name='username'
        defaultValue={state.name}
      />
      <InputWithLabel
        label='Email'
        required
        id='email'
        name='email'
        defaultValue={state.email}
      />
      <SelectWithLabel
        label='Rol'
        required
        id='role'
        name='role'
        defaultValue={state.role}
        className='w-full'
        values={roles.map((role) => ({ label: role, value: role }))}
      />
      <InputWithLabel
        required
        label='Contraseña'
        id='password'
        name='password'
        defaultValue={state.password}
      />
      <Button type='submit' disabled={isPending}>
        Guardar
      </Button>
    </form>
  );
}
