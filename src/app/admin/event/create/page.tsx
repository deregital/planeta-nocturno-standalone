import { CreateEventStoreProvider } from '@/app/admin/event/create/provider';
import GoBack from '@/components/common/GoBack';
import { Steps } from '@/components/event/create/steps';

export default function CreateEventPage() {
  return (
    <div className='flex flex-col gap-2 items-center h-main-screen'>
      <GoBack title='Volver a eventos' className='self-baseline mx-4 mt-4' />
      <h1 className='text-4xl font-bold'>Crear evento</h1>
      <CreateEventStoreProvider>
        <Steps />
      </CreateEventStoreProvider>
    </div>
  );
}
