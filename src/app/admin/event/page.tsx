import { ticketTypesTranslation } from '@/lib/translations';
import { trpc } from '@/server/trpc/server';
import { format } from 'date-fns';
import React from 'react';

export default async function Events() {
  const events = await trpc.events.getAll();

  return (
    <ul className='gap-4'>
      {events.map((event, index) => (
        <React.Fragment key={index}>
          <li
            key={index}
            className='grid grid-cols-4 font-bold bg-pn-accent/30'
          >
            <p>Evento: </p>
            <p>{event.name}</p>
            <p>{format(event.startingDate, 'dd/MM/yyyy HH:mm')}</p>
            <p>{event.slug}</p>
          </li>
          <li
            key={index + '-label'}
            className='grid grid-cols-4 gap-4 border font-bold bg-pn-gray/30'
          >
            <p>Tipo de entrada</p>
            <p>Nombre</p>
            <p>Descripción</p>
            <p>Max por compra</p>
          </li>
          <ul>
            {event.ticketTypes.map((type, index) => {
              const { text } = ticketTypesTranslation[type.category];
              return (
                <li key={index + '-' + type.id} className='grid grid-cols-4'>
                  <p>{text}</p>
                  <p>{type.name}</p>
                  <p>{type.price}</p>
                  <p>{type.maxPerPurchase}</p>
                </li>
              );
            })}
          </ul>
        </React.Fragment>
      ))}
    </ul>
  );
}
