'use client';

import { useActionState } from 'react';

import { type User } from '@/server/types';
import { updateUser } from '@/app/admin/users/[id]/edit/actions';
import { UserForm } from '@/components/admin/users/UserForm';

export function EditUserForm({
  user,
}: {
  user: Pick<User, 'id' | 'fullName' | 'name' | 'email' | 'role'>;
}) {
  const [state, formAction, isPending] = useActionState(updateUser, {
    data: {
      fullName: user.fullName,
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      birthDate: '',
      dni: '',
      gender: 'male',
      phoneNumber: '',
    },
  });

  return (
    <UserForm
      type='EDIT'
      userId={user.id}
      errors={state.errors}
      initialState={state.data}
      formAction={formAction}
      isPending={isPending}
    />
  );
}
