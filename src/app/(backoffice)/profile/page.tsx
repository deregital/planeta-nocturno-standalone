import { redirect } from 'next/navigation';

import ProfileClient from '@/app/(backoffice)/profile/client';
import { requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';

export default async function ProfilePage() {
  const access = await requirePagePermission('profile:read');

  const user = await trpc.user.getById(access.userId);

  if (!user) {
    redirect('/login');
  }

  return (
    <div className='flex flex-col gap-4'>
      <ProfileClient
        initialData={{
          fullName: user.fullName,
          name: user.name,
          email: user.email,
          birthDate: user.birthDate,
          dni: user.dni,
          role: user.role,
          gender: user.gender,
          phoneNumber: user.phoneNumber,
          instagram: user.instagram ?? '',
        }}
        links={{
          mercadopago: user.mercadopago,
          googleDriveUrl: user.googleDriveUrl,
        }}
      />
    </div>
  );
}
