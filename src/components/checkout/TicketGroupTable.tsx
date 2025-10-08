import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { FEATURE_KEYS } from '@/server/constants/feature-keys';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

export function TicketGroupTable({
  ticketGroup,
}: {
  ticketGroup: RouterOutputs['ticketGroup']['getById'];
}) {
  const { data: serviceFee, isLoading } = trpc.feature.getByKey.useQuery(
    FEATURE_KEYS.SERVICE_FEE,
  );

  const subtotalPrice = ticketGroup.ticketTypePerGroups.reduce(
    (acc, type) => acc + (type.ticketType.price || 0) * type.amount,
    0,
  );

  const serviceFeePrice = serviceFee?.enabled
    ? subtotalPrice * (Number(serviceFee?.value ?? 0) / 100)
    : 0;

  const serviceFeeString = serviceFeePrice
    .toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/\s/g, '');

  const totalPriceString = (subtotalPrice + serviceFeePrice)
    .toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/\s/g, '');

  return (
    <div className='flex flex-col justify-center items-center border border-stroke p-4 rounded-xl w-full sm:w-xl md:w-2xl'>
      <div className='grid grid-cols-3 w-full text-lg'>
        <div className='text-black border-b border-stroke pb-1 pt-4'>
          Tipo de Ticket
        </div>
        <div className='text-black text-center border-b border-stroke pb-1 pt-4'>
          Valor
        </div>
        <div className='text-black text-right border-b border-stroke pb-1 pt-4'>
          Cantidad
        </div>
        {ticketGroup.ticketTypePerGroups.map((type, index) => (
          <React.Fragment key={index}>
            <div className='text-black py-4 border-b border-stroke/50'>
              {type.ticketType.name}
            </div>
            <div className='text-black text-center py-4 border-b border-stroke/50'>
              {type.ticketType.price ? (
                <p>${type.ticketType.price}</p>
              ) : (
                <p className='text-green-700 font-semibold'>GRATUITO</p>
              )}
            </div>
            <div className='text-black text-right py-4 border-b border-stroke/50'>
              {type.amount}
            </div>
          </React.Fragment>
        ))}
      </div>

      {isLoading ? (
        <div className='flex flex-col gap-4 items-center w-full mt-4'>
          <Skeleton className='w-full h-9' />
          <Skeleton className='w-full h-9' />
        </div>
      ) : (
        <>
          {serviceFee?.enabled && (
            <p className='w-full text-start text-lg mt-6'>
              Costo de servicio: {serviceFeeString}
            </p>
          )}
          <p className='w-full text-start text-lg mt-6'>
            Total: {totalPriceString}
          </p>
        </>
      )}
    </div>
  );
}
