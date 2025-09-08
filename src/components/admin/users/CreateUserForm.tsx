'use client';

import { useActionState } from 'react';

import { UserForm } from '@/components/admin/users/UserForm';
import { createUser } from '@/app/admin/users/create/actions';

export function CreateUserForm() {
  const [state, handleSubmit, isPending] = useActionState(createUser, {});

  return (
    <UserForm
      type='CREATE'
      state={state.data}
      handleSubmit={handleSubmit}
      isPending={isPending}
      errors={state.errors}
    />
  );
}
