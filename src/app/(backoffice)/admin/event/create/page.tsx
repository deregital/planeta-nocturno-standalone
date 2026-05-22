import { CreateEventStoreProvider } from '@/app/(backoffice)/admin/event/create/provider';
import { Steps } from '@/components/event/create/steps';

export default function CreateEventPage() {
  return (
    <div className='flex w-full flex-col items-center gap-2'>
      <CreateEventStoreProvider>
        <Steps />
      </CreateEventStoreProvider>
    </div>
  );
}
