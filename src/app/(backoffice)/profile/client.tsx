'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';

import { updateProfile } from '@/app/(backoffice)/profile/actions';
import { UserForm, type UserData } from '@/components/admin/config/UserForm';
import OrganizerLinks from '@/components/admin/organizer/OrganizerLinks';
import { usePermissions } from '@/components/rbac/PermissionsProvider';
import { Separator } from '@/components/ui/separator';

export default function ProfileClient({
  initialData,
  links,
}: {
  initialData: Omit<UserData, 'password'>;
  links: {
    mercadopago?: string | null;
    googleDriveUrl?: string | null;
  };
}) {
  const router = useRouter();
  const { can, roleName } = usePermissions();

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
      <div className='flex flex-wrap items-center gap-4'>
        <h1 className='text-3xl font-bold text-accent'>Mis Datos</h1>
        <div className='flex items-center justify-center mx-2 h-6'>
          <Separator orientation='vertical' className='border-accent border' />
        </div>
        <OrganizerLinks
          mode='self'
          mercadopago={links.mercadopago}
          googleDriveUrl={links.googleDriveUrl}
        />
      </div>
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
          lockedRoleLabel={roleName ?? undefined}
          readOnly={!can('profile:update')}
        />
      </div>
    </div>
  );
}
