'use client';
import React, { startTransition, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type RouterOutputs } from '@/server/routers/app';
import { useEventTickets } from '@/hooks/useEventTickets';
import { handlePurchase as handlePurchaseAction } from '@/app/event/[slug]/actions';

function TicketPurchase({
  ticketTypes,
  eventId,
}: {
  ticketTypes: RouterOutputs['events']['getById']['ticketTypes'];
  eventId: string;
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
    <div className='rounded-[20px] border border-MiExpo_gray p-6 bg-white h-full flex flex-col font-sans'>
      {/* Encabezado de la tabla */}
      <div className='grid grid-cols-3 pb-2 border-b border-MiExpo_gray'>
        <div className='text-MiExpo_black text-[12px] sm:text-[16px] font-normal leading-[100%]'>
          Tipo de Ticket
        </div>
        <div className='text-MiExpo_black text-[12px] sm:text-[16px] font-normal leading-[100%] text-center'>
          Valor
        </div>
        <div className='text-MiExpo_black text-[12px] sm:text-[16px] font-normal leading-[100%] text-right'>
          Cantidad
        </div>
      </div>

      {/* Fila de ticket */}
      <div className='grid grid-cols-3 py-4 gap-2 items-center'>
        {ticketsTypeAvailable.map((type, index) => {
          return (
            <React.Fragment key={index}>
              <div className='text-MiExpo_black text-[12px] sm:text-[16px] font-normal leading-[100%]'>
                {type.name}
              </div>
              <div className='text-MiExpo_black text-[12px] sm:text-[16px] font-normal leading-[100%] text-center'>
                {type.price ? (
                  <p>${type.price}</p>
                ) : (
                  <p className='text-green-700'>GRATUITO</p>
                )}
              </div>
              <div className='flex justify-end'>
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
                    <SelectTrigger className='w-24 bg-white text-MiExpo_black border border-MiExpo_gray'>
                      <SelectValue placeholder='0' />
                    </SelectTrigger>
                    <SelectContent align='end'>
                      {[...Array(type.maxPerPurchase + 1).keys()]
                        .map((i) => i)
                        .map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num.toString()}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className='text-red-500 font-medium text-[12px] sm:text-[16px]'>
                    Entradas agotadas!
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Botón de compra */}
      <div className='mt-4 grid grid-cols-3'>
        <Button
          variant='accent'
          onClick={() =>
            startTransition(() =>
              handlePurchase({ eventId, ticketsPerType: quantity }),
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
