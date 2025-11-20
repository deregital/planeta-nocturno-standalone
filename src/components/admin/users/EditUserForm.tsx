'use client';

import { useActionState } from 'react';

import { updateUser } from '@/app/(backoffice)/admin/users/[id]/edit/actions';
import { UserForm } from '@/components/admin/users/UserForm';
import { type User } from '@/server/types';

export function EditUserForm({ user }: { user: User }) {
  const [state, formAction, isPending] = useActionState(updateUser, {
    data: {
      fullName: user.fullName,
      name: user.name,
      email: user.email,
      role: user.role,
      password: user.password,
      birthDate: user.birthDate,
      dni: user.dni,
      gender: user.gender,
      phoneNumber: user.phoneNumber,
      instagram: user.instagram,
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
