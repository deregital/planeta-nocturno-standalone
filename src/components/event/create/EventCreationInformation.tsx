'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/server/trpc/client';
import { useCreateEventStore } from '@/app/admin/event/create/provider';
import { useShallow } from 'zustand/react/shallow';

export function EventCreationInformation() {
  const createEventMutation = trpc.events.create.useMutation();
  const { event, setEvent } = useCreateEventStore(
    useShallow((state) => ({
      event: state.event,
      setEvent: state.setEvent,
    })),
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createEventMutation.mutate(event);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.type === 'checkbox') {
      setEvent({ [e.target.name]: e.target.checked });
    } else {
      setEvent({ [e.target.name]: e.target.value });
    }
  };

  return (
    <form
      className='flex flex-col gap-2 justify-center max-w-md'
      onSubmit={handleSubmit}
    >
      <Input
        type='text'
        placeholder='Nombre del evento'
        name='name'
        value={event.name}
        onChange={handleChange}
      />
      <Input
        type='text'
        placeholder='Descripción del evento'
        name='description'
        value={event.description}
        onChange={handleChange}
      />
      <div className='flex gap-2'>
        <Input
          type='date'
          placeholder='Fecha del evento'
          name='eventDate'
          value={event.startingDate.toISOString().split('T')[0]}
          onChange={(e) => {
            const date = new Date(e.target.value);
            setEvent({ startingDate: date, endingDate: date });
          }}
        />
        <Input
          type='time'
          placeholder='Hora de inicio'
          name='startTime'
          value={event.startingDate.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          onChange={(e) => {
            const [hours, minutes] = e.target.value.split(':');
            const newDate = new Date(event.startingDate);
            newDate.setHours(parseInt(hours), parseInt(minutes));

            setEvent({ startingDate: newDate });
          }}
        />
        <Input
          type='time'
          placeholder='Hora de fin'
          name='endTime'
          value={event.endingDate.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          onChange={(e) => {
            const [hours, minutes] = e.target.value.split(':');
            const startHours = event.startingDate.getHours();
            const newDate = new Date(event.startingDate);
            newDate.setHours(parseInt(hours), parseInt(minutes));

            // If end time is after midnight and start time isn't, add a day
            if (parseInt(hours) < startHours && parseInt(hours) < 24) {
              newDate.setDate(newDate.getDate() + 1);
            }

            setEvent({ endingDate: newDate });
          }}
        />
      </div>
      <Input
        type='number'
        placeholder='Edad mínima'
        name='minAge'
        value={event.minAge ?? ''}
        onChange={handleChange}
      />
      <Input
        type='checkbox'
        placeholder='Activo'
        name='isActive'
        checked={event.isActive}
        onChange={handleChange}
      />
      <Input
        type='text'
        placeholder='ID de la ubicación'
        name='locationId'
        value={event.locationId}
        onChange={handleChange}
      />
      <Input
        type='text'
        placeholder='ID de la categoría'
        name='categoryId'
        value={event.categoryId}
        onChange={handleChange}
      />
      <Button type='submit' variant={'accent'}>
        Crear evento
      </Button>
    </form>
  );
}
