import { notFound } from 'next/navigation';

import { EditOrganizerForm } from '@/components/admin/users/EditOrganizerForm';
import { trpc } from '@/server/trpc/server';

export default async function EditUserPage(
  props: PageProps<'/admin/users/[id]/edit'>,
) {
  const paramsPage = await props.params;
  const { id } = paramsPage;

  const user = await trpc.user.getById(id);

  if (!user) {
    return notFound();
  }

  return (
    <div className='flex flex-col gap-4 p-4'>
      <h1 className='text-2xl font-bold'>Editar Usuario</h1>
      <EditOrganizerForm user={user} />
    </div>
  );
}
