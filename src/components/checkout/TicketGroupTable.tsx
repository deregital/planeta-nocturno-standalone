import { type RouterOutputs } from '@/server/routers/app';
import React from 'react';

export function TicketGroupTable({
  ticketGroup,
}: {
  ticketGroup: RouterOutputs['ticketGroup']['getById'];
}) {
  const totalPrice = ticketGroup.ticketTypePerGroups
    .reduce((acc, type) => acc + (type.ticketType.price || 0) * type.amount, 0)
    .toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/\s/g, '');

  return (
    <div className='flex flex-col justify-center items-center border border-pn-gray p-4 rounded-sm w-full sm:w-xl md:w-2xl'>
      <div className='grid grid-cols-3 w-full text-lg'>
        <div className='text-pn-text-primary border-b border-pn-gray pb-1 pt-4'>
          Tipo de Ticket
        </div>
        <div className='text-pn-text-primary text-center border-b border-pn-gray pb-1 pt-4'>
          Valor
        </div>
        <div className='text-pn-text-primary text-right border-b border-pn-gray pb-1 pt-4'>
          Cantidad
        </div>
        {ticketGroup.ticketTypePerGroups.map((type, index) => (
          <React.Fragment key={index}>
            <div className='text-pn-text-primary py-4 border-b border-pn-gray/50'>
              {type.ticketType.name}
            </div>
            <div className='text-pn-text-primary text-center py-4 border-b border-pn-gray/50'>
              {type.ticketType.price ? (
                <p>${type.ticketType.price}</p>
              ) : (
                <p className='text-green-700 font-semibold'>GRATUITO</p>
              )}
            </div>
            <div className='text-pn-text-primary text-right py-4 border-b border-pn-gray/50'>
              {type.amount}
            </div>
          </React.Fragment>
        ))}
      </div>
      <p className='w-full text-start text-lg mt-6'>Total: {totalPrice}</p>
    </div>
  );
}
