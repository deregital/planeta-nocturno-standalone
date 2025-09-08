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
  const [state, handleSubmit, isPending] = useActionState(updateUser, {
    data: {
      ...user,
      name: user.name,
      password: '',
    },
    errors: {
      general: '',
      fullName: '',
      name: '',
      email: '',
      role: '',
      password: '',
    },
  });

  return (
    <UserForm
      type='EDIT'
      userId={user.id}
      errors={state.errors}
      state={state.data}
      handleSubmit={handleSubmit}
      isPending={isPending}
    />
  );
}
