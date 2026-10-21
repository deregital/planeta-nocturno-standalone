import { CreateEventStoreProvider } from '@/app/(backoffice)/admin/event/create/provider';
import { Steps } from '@/components/event/create/steps';
import { requirePagePermission } from '@/server/rbac/guards';

export default async function CreateEventPage() {
  await requirePagePermission('events:create');

  return (
    <div className='flex w-full flex-col items-center gap-2'>
      <CreateEventStoreProvider>
        <Steps />
      </CreateEventStoreProvider>
    </div>
  );
}
