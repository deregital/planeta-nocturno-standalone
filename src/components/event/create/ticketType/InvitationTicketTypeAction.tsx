import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Button } from '@/components/ui/button';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';

type InvitationTicketTypeActionProps =
  | {
      action: 'CREATE';
      next: () => void;
      back?: () => void;
    }
  | {
      action: 'EDIT';
      next?: never;
      back?: never;
    };

export function InvitationTicketTypeAction({
  action,
  next,
  back,
}: InvitationTicketTypeActionProps) {
  const ticketTypes = useCreateEventStore((state) => state.ticketTypes);
  const addTicketType = useCreateEventStore((state) => state.addTicketType);
  const updateTicketType = useCreateEventStore(
    (state) => state.updateTicketType,
  );
  const setTicketTypes = useCreateEventStore((state) => state.setTicketTypes);
  const organizers = useCreateEventStore((state) => state.organizers);
  const addOrganizerTicketType = useCreateEventStore(
    (state) => state.addOrganizerTicketType,
  );

  // Encontrar el ticket único existente (excluyendo el ticket de organizador)
  const existingUniqueTicket = ticketTypes.find(
    (t) => t.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim(),
  );

  const [ticketTypeInfo, setTicketTypeInfo] = useState<{
    name: string;
    description: string;
  }>({
    name: existingUniqueTicket?.name ?? '',
    description: existingUniqueTicket?.description ?? '',
  });

  // Actualizar el estado cuando cambien los ticketTypes (al cargar un evento para editar)
  useEffect(() => {
    const currentUniqueTicket = ticketTypes.find(
      (t) => t.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim(),
    );
    if (currentUniqueTicket) {
      setTicketTypeInfo({
        name: currentUniqueTicket.name ?? '',
        description: currentUniqueTicket.description ?? '',
      });
    }
  }, [ticketTypes]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    const fieldName = e.target.name as 'name' | 'description';

    // Actualizar el estado local
    const updatedInfo = {
      ...ticketTypeInfo,
      [fieldName]: newValue,
    };
    setTicketTypeInfo(updatedInfo);

    // En modo EDIT, actualizar directamente el store
    if (action === 'EDIT') {
      const currentUniqueTicket = ticketTypes.find(
        (t) => t.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim(),
      );
      if (currentUniqueTicket?.id) {
        updateTicketType(currentUniqueTicket.id, {
          ...currentUniqueTicket,
          name: updatedInfo.name,
          description: updatedInfo.description,
        });
      }
    }
  }

  function handleNext() {
    if (ticketTypeInfo.name === '' || ticketTypeInfo.description === '') {
      toast.error('Debes completar todos los campos');
      return;
    }

    // Recalcular el ticket único existente para asegurar que tenemos el valor más reciente
    const currentUniqueTicket = ticketTypes.find(
      (t) => t.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim(),
    );

    if (action === 'CREATE') {
      // Modo CREATE: crear nuevo ticket si no existe
      if (currentUniqueTicket?.id) {
        // Si ya existe, actualizar solo nombre y descripción
        updateTicketType(currentUniqueTicket.id, {
          ...currentUniqueTicket,
          name: ticketTypeInfo.name,
          description: ticketTypeInfo.description,
        });
      } else {
        // Si no existe, limpiar todos los tickets y crear uno nuevo
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
            if (
              'ticketAmount' in organizer &&
              organizer.ticketAmount !== null
            ) {
              return acc + organizer.ticketAmount;
            }
            return acc;
          }, 0),
          maxPerPurchase: 1,
          maxSellDate: null,
        });
      }

      // Asegurarse de que el ticket de organizador existe
      const organizerTicketExists = ticketTypes.some(
        (t) => t.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim(),
      );
      if (!organizerTicketExists) {
        addOrganizerTicketType();
      }

      next?.();
    }
  }

  return (
    <div className='w-full'>
      <section className='p-4 border-2 border-stroke rounded-md w-full flex flex-col gap-4 bg-accent-ultra-light'>
        <h3 className='text-2xl text-center font-bold'>Ticket Único</h3>
        <InputWithLabel
          id='name'
          placeholder='Nombre del ticket gratuito único'
          name='name'
          label='Nombre del ticket'
          value={ticketTypeInfo.name}
          onChange={handleChange}
          required
        />
        <InputWithLabel
          id='description'
          placeholder='Descripción del ticket gratuito único'
          name='description'
          label='Descripción del ticket'
          value={ticketTypeInfo.description}
          onChange={handleChange}
          required
        />
      </section>
      {action === 'CREATE' && (
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
      )}
    </div>
  );
}
