import { useState } from 'react';
import { toast } from 'sonner';

import { useCreateEventStore } from '@/app/admin/event/create/provider';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Button } from '@/components/ui/button';

export function InvitationTicketTypeAction({
  next,
  back,
}: {
  back: () => void;
  next: () => void;
}) {
  const ticketTypes = useCreateEventStore((state) => state.ticketTypes);
  const addTicketType = useCreateEventStore((state) => state.addTicketType);
  const setTicketTypes = useCreateEventStore((state) => state.setTicketTypes);
  const organizers = useCreateEventStore((state) => state.organizers);
  const [ticketTypeInfo, setTicketTypeInfo] = useState<{
    name: string;
    description: string;
  }>({
    name: '',
    description: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTicketTypeInfo({
      ...ticketTypeInfo,
      [e.target.name]: e.target.value,
    });
  }

  function handleNext() {
    if (ticketTypeInfo.name === '' || ticketTypeInfo.description === '') {
      toast.error('Debes completar todos los campos');
      return;
    }

    if (ticketTypes.length > 0) {
      setTicketTypes([]);
    }

    addTicketType({
      id: crypto.randomUUID(),
      category: 'FREE',
      scanLimit: null,
      visibleInWeb: true,
      lowStockThreshold: null,
      name: ticketTypeInfo.name,
      description: ticketTypeInfo.description,
      price: 0,
      maxAvailable: organizers.reduce((acc, organizer) => {
        if ('ticketAmount' in organizer) {
          return acc + organizer.ticketAmount;
        }
        return acc;
      }, 0),
      maxPerPurchase: 1,
      maxSellDate: null,
    });

    next();
  }

  return (
    <div className='w-full'>
      <section className='p-4 border-2 border-stroke rounded-md w-full flex flex-col gap-4 bg-accent-ultra-light'>
        <h3 className='text-2xl text-center font-bold'>Entrada Única</h3>
        <InputWithLabel
          id='name'
          placeholder='Nombre de la entrada gratuita única'
          name='name'
          label='Nombre de la entrada'
          value={ticketTypeInfo.name}
          onChange={handleChange}
        />
        <InputWithLabel
          id='description'
          placeholder='Descripción de la entrada gratuita única'
          name='description'
          label='Descripción de la entrada'
          value={ticketTypeInfo.description}
          onChange={handleChange}
        />
      </section>
      <div className='flex flex-1 mt-4 w-full gap-4'>
        {back && (
          <Button className='flex-1' onClick={back} variant={'outline'}>
            Volver
          </Button>
        )}
        <Button className='flex-1' variant={'accent'} onClick={handleNext}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
