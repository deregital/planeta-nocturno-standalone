'use client';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';
import { type TicketType } from '@/server/types';
import { useState, useEffect } from 'react';

export function useEventTickets(
  eventId: string,
  ticketTypes: RouterOutputs['events']['getById']['ticketTypes'],
) {
  const [quantity, setQuantity] = useState<
    { ticketTypeId: string; amount: number }[]
  >([]);

  const [ticketsAvailable, setTicketsAvailable] = useState<
    Array<
      Pick<
        TicketType,
        'id' | 'maxPerPurchase' | 'name' | 'description' | 'price'
      > & { disabled: boolean }
    >
  >([]);

  const { data: ticketGroups, isLoading } =
    trpc.ticketGroup.getTicketsByEvent.useQuery(eventId);

  useEffect(() => {
    if (!ticketGroups || isLoading) return;
    setTicketsAvailable(
      ticketTypes.map((type) => {
        const ticketTypeEmmitted = ticketGroups.reduce((acum, current) => {
          return (
            acum +
            (current.ticketTypePerGroups.find(
              (t) => t.ticketType.id === type.id,
            )?.amount || 0)
          );
        }, 0);

        const disabled = ticketTypeEmmitted >= type.maxAvailable;

        console.log(
          type.name,
          ticketTypeEmmitted,
          type.maxAvailable,
          type.maxPerPurchase,
          disabled,
        );
        const maxPerPurchase =
          type.maxAvailable - ticketTypeEmmitted < type.maxPerPurchase
            ? type.maxAvailable - ticketTypeEmmitted
            : type.maxPerPurchase;

        return {
          id: type.id,
          name: type.name,
          description: type.description,
          price: type.price,
          disabled,
          maxPerPurchase,
        };
      }),
    );
    setQuantity(
      ticketTypes.map((type) => ({
        ticketTypeId: type.id,
        amount: 0,
      })),
    );
  }, [eventId, isLoading, ticketGroups, ticketTypes]);

  return { ticketsAvailable, quantity, setQuantity, isLoading };
}
