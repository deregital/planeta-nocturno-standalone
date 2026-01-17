import { redirect } from 'next/navigation';

import ProfileClient from '@/app/(backoffice)/profile/client';
import { auth } from '@/server/auth';
import { trpc } from '@/server/trpc/server';

export default async function ProfilePage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const user = await trpc.user.getById(session.user.id);

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
      />
    </div>
  );
}
