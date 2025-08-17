import { CreateEventStoreProvider } from '@/app/admin/event/create/provider';
import { Steps } from '@/components/event/create/steps';

export default function CreateEventPage() {
  return (
    <div className='flex flex-col gap-2 items-center h-main-screen'>
      <h1 className='text-4xl font-bold my-4'>Crear evento</h1>
      <CreateEventStoreProvider>
        <Steps />
      </CreateEventStoreProvider>
    </div>
  );
}
