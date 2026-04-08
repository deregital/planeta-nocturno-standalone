'use client';
import { format } from 'date-fns';
import { startTransition, useActionState } from 'react';

import { handlePurchase as handlePurchaseAction } from '@/app/(client)/event/[slug]/actions';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEventTickets } from '@/hooks/useEventTickets';
import { type RouterOutputs } from '@/server/routers/app';

function TicketPurchase({
  ticketTypes,
  eventId,
  invitedBy,
  eventStartingDate,
}: {
  ticketTypes: NonNullable<RouterOutputs['events']['getBySlug']>['ticketTypes'];
  eventId: string;
  invitedBy: string | null;
  eventStartingDate: string;
}) {
  const [, handlePurchase, pending] = useActionState(
    handlePurchaseAction,
    undefined,
  );

  const {
    ticketsAvailable: ticketsTypeAvailable,
    quantity,
    setQuantity,
    isLoading,
  } = useEventTickets(eventId, ticketTypes);

  return (
    <div className='rounded-[20px] border border-stroke p-6 bg-accent-ultra-light h-full flex flex-col font-sans'>
      {/* Encabezado */}
      <div className='hidden sm:flex items-center pb-2 border-b border-stroke'>
        <div className='flex-1 text-accent-dark text-base font-normal'>
          Tipo de ticket
        </div>
        <div className='text-accent-dark text-base font-normal text-center w-24'>
          Valor
        </div>
        <div className='text-accent-dark text-base font-normal text-right w-24'>
          Cantidad
        </div>
      </div>

      {ticketTypes.length === 0 ? (
        <div className='text-red-500 font-medium my-4'>
          No hay tickets disponibles
        </div>
      ) : (
        <div className='flex flex-col gap-4 py-4'>
          {ticketsTypeAvailable.map((type) => (
            <div
              key={type.id}
              className='flex flex-col gap-2 sm:flex-row sm:items-center border-b border-stroke/50 pb-4 sm:border-none sm:pb-0'
            >
              <div className='flex-1 min-w-0'>
                <div className='text-base sm:text-base font-medium flex items-baseline gap-2'>
                  {type.name}
                  {(() => {
                    const original = ticketTypes.find((t) => t.id === type.id);
                    if (
                      original?.startingDate &&
                      new Date(original.startingDate).getTime() !==
                        new Date(eventStartingDate).getTime()
                    ) {
                      return (
                        <span className='text-accent-dark/60 text-xs font-normal'>
                          {`(Inicio ${format(new Date(original.startingDate), 'HH:mm')} hs)`}
                        </span>
                      );
                    }
                  })()}
                </div>
                {type.description && (
                  <p className='text-accent-dark/70 text-xs sm:text-sm mt-0.5 leading-snug'>
                    {type.description}
                  </p>
                )}
                {!type.disabled && type.leftAvailable && (
                  <span className='text-red-500 font-medium text-xs sm:text-sm'>
                    ¡Quedan {type.leftAvailable} tickets!
                  </span>
                )}
              </div>
              <div className='flex items-center justify-between sm:contents'>
                <div className='text-black font-normal sm:text-center w-auto sm:w-24 sm:shrink-0'>
                  {type.price ? (
                    <p>
                      {Intl.NumberFormat('es-AR', {
                        style: 'currency',
                        currency: 'ARS',
                        maximumFractionDigits: 0,
                      })
                        .format(type.price)
                        .replace(/\$\s*/, '$')}
                    </p>
                  ) : (
                    <p className='text-accent'>GRATUITO</p>
                  )}
                </div>
                <div className='flex justify-end sm:w-24 sm:shrink-0'>
                  {!type.disabled ? (
                    <Select
                      value={quantity
                        .find((q) => q.ticketTypeId === type.id)!
                        .amount.toString()}
                      onValueChange={(value) =>
                        setQuantity([
                          ...quantity.filter((q) => q.ticketTypeId !== type.id),
                          { ticketTypeId: type.id, amount: parseInt(value) },
                        ])
                      }
                    >
                      <SelectTrigger className='w-24 bg-white text-black border border-stroke'>
                        <SelectValue placeholder='0' />
                      </SelectTrigger>
                      <SelectContent align='end'>
                        {[...Array(type.maxPerPurchase + 1).keys()].map(
                          (num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num.toString()}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className='text-red-500 font-medium'>¡Agotados!</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botón de compra */}
      <div className='mt-4 grid grid-cols-3'>
        <Button
          variant='accent'
          onClick={() =>
            startTransition(() =>
              handlePurchase({ eventId, ticketsPerType: quantity, invitedBy }),
            )
          }
          disabled={
            ticketsTypeAvailable.every((ticket) => ticket.disabled) ||
            isLoading ||
            pending ||
            quantity.every((q) => q.amount === 0)
          }
        >
          {ticketsTypeAvailable ? 'COMPRAR' : 'AGOTADO'}
        </Button>
      </div>
    </div>
  );
}

export default TicketPurchase;
