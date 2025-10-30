import React from 'react';

import FeatureWrapper from '@/components/admin/config/FeatureWrapper';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils-client';
import { FEATURE_KEYS } from '@/server/constants/feature-keys';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

export function TicketGroupTable({
  ticketGroup,
  discountPercentage,
}: {
  ticketGroup: RouterOutputs['ticketGroup']['getById'];
  discountPercentage?: number | null;
}) {
  const { data: serviceFee, isLoading } = trpc.feature.getByKey.useQuery(
    FEATURE_KEYS.SERVICE_FEE,
  );

  const subtotalPrice = ticketGroup.ticketTypePerGroups.reduce(
    (acc, type) => acc + (type.ticketType.price || 0) * type.amount,
    0,
  );

  const hasDiscount =
    discountPercentage !== null &&
    discountPercentage !== undefined &&
    discountPercentage > 0;
  const subtotalWithDiscount = hasDiscount
    ? subtotalPrice * (1 - discountPercentage / 100)
    : subtotalPrice;

  // Calculate service fee over the subtotal (pre-discount)
  const serviceFeePrice = serviceFee?.enabled
    ? subtotalPrice * (Number(serviceFee?.value ?? 0) / 100)
    : 0;

  const subtotalPriceString = formatCurrency(subtotalPrice);
  const subtotalWithDiscountString = formatCurrency(subtotalWithDiscount);
  const serviceFeeString = formatCurrency(serviceFeePrice);
  const totalPriceString = formatCurrency(
    subtotalWithDiscount + serviceFeePrice,
  );

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
        <div className='w-full flex-col flex items-end mt-4 [&>div]:w-full [&>div]:md:w-3/5 [&>div]:min-w-44 [&>div]:flex [&>div]:justify-between'>
          <div className='my-3 [&>p]:text-end [&>p]:text-lg'>
            <p>Subtotal:</p>
            {hasDiscount ? (
              <p className='line-through text-gray-500'>
                {subtotalPriceString}
              </p>
            ) : (
              <p>{subtotalPriceString}</p>
            )}
          </div>

          {hasDiscount && (
            <div className='my-3 [&>p]:text-end [&>p]:text-lg'>
              <p>Subtotal con descuento:</p>
              <p className='text-green-600 font-semibold'>
                {subtotalWithDiscountString}
              </p>
            </div>
          )}
          <FeatureWrapper feature={FEATURE_KEYS.SERVICE_FEE}>
            <div className='mb-3 [&>p]:text-end [&>p]:text-lg'>
              <p>Costo de servicio:</p>
              <p>{serviceFeeString}</p>
            </div>
          </FeatureWrapper>
          <Separator className='flex bg-stroke data-[orientation=horizontal]:min-w-44 data-[orientation=horizontal]:w-full data-[orientation=horizontal]:md:w-3/5' />
          <div className='mt-3 [&>p]:text-end [&>p]:text-lg'>
            <p>Total:</p>
            <p>{totalPriceString}</p>
          </div>
        </div>
      )}
    </div>
  );
}
