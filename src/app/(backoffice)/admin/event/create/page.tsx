import { CreateEventStoreProvider } from '@/app/(backoffice)/admin/event/create/provider';
import { Steps } from '@/components/event/create/steps';

export default function CreateEventPage() {
  return (
    <div className='flex flex-col gap-2 items-center'>
      <CreateEventStoreProvider>
        <Steps />
      </CreateEventStoreProvider>
    </div>
  );
}
