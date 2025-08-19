import { useCreateEventStore } from '@/app/admin/event/create/provider';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Button } from '@/components/ui/button';
import { trpc } from '@/server/trpc/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import TicketTypeList from './ticketType/TicketTypeList';
import Image from 'next/image';
import { Label } from '@/components/ui/label';

export default function PreviewEvent({ back }: { back: () => void }) {
  const { ticketTypes, event, setEvent } = useCreateEventStore(
    useShallow((state) => ({
      ticketTypes: state.ticketTypes,
      event: state.event,
      setEvent: state.setEvent,
    })),
  );

  const createEvent = trpc.events.create.useMutation();

  const router = useRouter();

  const { data: location } = trpc.location.getById.useQuery(event.locationId);
  const { data: category } = trpc.eventCategory.getById.useQuery(
    event.categoryId,
  );
  const handleSubmit = async () => {
    try {
      await createEvent.mutateAsync({ event, ticketTypes });
      toast('¡Evento creado con éxito!');
      router.push('/admin/event');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast(`UUUH WACHo: ${msg}`);
    }
  };

  return (
    <div className='w-full  [&>section]:flex [&>section]:flex-col [&>section]:gap-4 [&>section]:my-6 [&>section]:p-4 [&>section]:border-2 [&>section]:border-pn-gray [&>section]:rounded-md [&>section]:w-full'>
      <Button className='self-baseline' onClick={back} variant={'outline'}>
        Volver
      </Button>
      <h2 className='text-2xl text-center'>Previsualización del evento</h2>
      <section>
        <div className='flex flex-col md:flex-row gap-4 justify-between w-full'>
          <div className='w-full flex flex-col gap-4'>
            <h3 className='text-2xl'>Descripción general del evento</h3>
            <InputWithLabel
              id='name'
              label='Nombre del evento'
              value={event.name}
              readOnly
            />
            <InputWithLabel
              id='description'
              label='Descripción del evento'
              value={event.description}
              readOnly
            />
          </div>
          <div className='flex flex-col gap-1 w-full md:max-w-1/3 items-center'>
            <Label className='text-sm text-pn-accent'>Imagen de portada</Label>
            <Image
              className='max-h-[150px] rounded-md h-full w-auto'
              src={event.coverImageUrl}
              alt='Cover image'
              width={100}
              height={100}
            />
          </div>
        </div>
      </section>
      <section>
        <h3 className='text-2xl'>Fecha y hora</h3>
        <InputWithLabel
          id='startingDate'
          label='Fecha y hora de inicio'
          type='datetime-local'
          value={event.startingDate.toISOString().slice(0, 19)}
          readOnly
        />
        <InputWithLabel
          id='endingDate'
          label='Fecha y hora de finalización'
          type='datetime-local'
          value={event.endingDate.toISOString().slice(0, 19)}
          readOnly
        />
      </section>
      <section>
        <h3 className='text-2xl'>Locación</h3>
        <InputWithLabel
          id='location'
          label='Ubicación del evento'
          value={
            location
              ? `${location?.name} (${location?.address})`
              : 'Sin locación'
          }
          readOnly
        />
      </section>
      <section>
        <h3 className='text-2xl'>Categoría</h3>
        <InputWithLabel
          id='category'
          label='Ubicación del evento'
          value={category?.name ?? 'Sin categoría'}
          readOnly
        />
      </section>
      <section>
        <h3 className='text-2xl'>Entradas</h3>
        <TicketTypeList
          action='READ'
          ticketTypes={ticketTypes}
          maxAvailableLeft={0}
        />
      </section>
      <section>
        <h3 className='text-2xl'>Activar la venta de entradas</h3>
        <InputWithLabel
          label='Activo'
          id='isActive'
          type='checkbox'
          placeholder='Activo'
          name='isActive'
          onChange={(e) => {
            setEvent({ isActive: e.target.checked });
          }}
          defaultValue={event.isActive.toString() ?? 'false'}
        />
      </section>
      <Button
        variant={'accent'}
        className='w-full justify-self-end'
        onClick={() => handleSubmit()}
      >
        Crear evento
      </Button>
    </div>
  );
}
