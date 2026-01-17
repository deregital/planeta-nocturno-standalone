'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';

import { updateProfile } from '@/app/(backoffice)/profile/actions';
import { UserForm, type UserData } from '@/components/admin/config/UserForm';

export default function ProfileClient({
  initialData,
}: {
  initialData: Omit<UserData, 'password'>;
}) {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(updateProfile, {
    data: initialData,
  });

  useEffect(() => {
    if (state.success) {
      toast.success('Perfil actualizado correctamente');
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div className='flex flex-col gap-4 p-4'>
      <h1 className='text-4xl font-bold text-accent'>Mis Datos</h1>
      <div className='max-w-2xl mx-auto w-full'>
        <UserForm
          type='EDIT'
          initialState={
            state.data ? { ...state.data, role: initialData.role } : initialData
          }
          formAction={formAction}
          isPending={isPending}
          errors={state.errors}
          lockedRole={initialData.role}
        />
      </div>
    </div>
  );
}
