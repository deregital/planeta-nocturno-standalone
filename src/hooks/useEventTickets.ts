'use client';
import { useEffect, useState } from 'react';

import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';
import { type TicketType } from '@/server/types';

export function useEventTickets(
  eventId: string,
  ticketTypes: NonNullable<RouterOutputs['events']['getBySlug']>['ticketTypes'],
) {
  const [quantity, setQuantity] = useState<
    { ticketTypeId: string; amount: number }[]
  >([]);

  const [ticketsAvailable, setTicketsAvailable] = useState<
    Array<
      Pick<
        TicketType,
        'id' | 'maxPerPurchase' | 'name' | 'description' | 'price' | 'imageUrl'
      > & { disabled: boolean; leftAvailable: number | null }
    >
  >([]);

  const { data: ticketGroups, isLoading } =
    trpc.ticketGroup.getTicketsByEvent.useQuery(eventId);

  useEffect(() => {
    if (!ticketGroups || isLoading) return;

    const availableTypes = ticketTypes.map((type) => {
      const ticketTypeEmitted = ticketGroups.reduce((acum, current) => {
        return (
          acum +
          (current.ticketTypePerGroups.find((t) => t.ticketType.id === type.id)
            ?.amount || 0)
        );
      }, 0);

      const disabled = ticketTypeEmitted >= type.maxAvailable;

      const available = type.maxAvailable - ticketTypeEmitted;

      const leftAvailable =
        type.lowStockThreshold === null
          ? null
          : available <= type.lowStockThreshold
            ? available
            : null;

      const maxPerPurchase =
        type.maxAvailable - ticketTypeEmitted < type.maxPerPurchase
          ? type.maxAvailable - ticketTypeEmitted
          : type.maxPerPurchase;

      return {
        id: type.id,
        name: type.name,
        description: type.description,
        price: type.price,
        imageUrl: type.imageUrl,
        disabled,
        maxPerPurchase,
        leftAvailable,
      };
    });

    setTicketsAvailable(availableTypes);

    // Si hay un solo tipo de ticket free y disponible, preseleccionar 1
    const shouldDefaultSelectOne =
      availableTypes.length === 1 &&
      (availableTypes[0].price ?? 0) === 0 &&
      !availableTypes[0].disabled &&
      availableTypes[0].maxPerPurchase >= 1;

    setQuantity(
      availableTypes.map((type) => ({
        ticketTypeId: type.id,
        amount: shouldDefaultSelectOne ? 1 : 0,
      })),
    );
  }, [eventId, isLoading, ticketGroups, ticketTypes]);

  return { ticketsAvailable, quantity, setQuantity, isLoading };
}
