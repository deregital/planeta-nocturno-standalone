'use client';

import { useCallback, useState } from 'react';

import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import {
  type EventOrganizersState,
  type OrganizerTicketTypeRef,
} from '@/lib/event-organizers';
import {
  type OrganizerBaseSchema,
  type OrganizerSchema,
} from '@/server/schemas/organizer';
import { type InviteCondition } from '@/server/types';

export function useCreateEventOrganizersState(): EventOrganizersState {
  const organizers = useCreateEventStore((state) => state.organizers);
  const addOrganizer = useCreateEventStore((state) => state.addOrganizer);
  const deleteOrganizer = useCreateEventStore((state) => state.deleteOrganizer);
  const updateOrganizerNumber = useCreateEventStore(
    (state) => state.updateOrganizerNumber,
  );
  const updateAllOrganizerNumber = useCreateEventStore(
    (state) => state.updateAllOrganizerNumber,
  );
  const sendOrganizerTicketEmail = useCreateEventStore(
    (state) => state.sendOrganizerTicketEmail,
  );
  const setSendOrganizerTicketEmail = useCreateEventStore(
    (state) => state.setSendOrganizerTicketEmail,
  );
  const event = useCreateEventStore((state) => state.event);
  const ticketTypes = useCreateEventStore((state) => state.ticketTypes);
  const eventId =
    'id' in event && typeof event.id === 'string' ? event.id : undefined;

  return {
    organizers,
    addOrganizer,
    deleteOrganizer,
    updateOrganizerNumber,
    updateAllOrganizerNumber,
    sendOrganizerTicketEmail,
    setSendOrganizerTicketEmail,
    locationId: event.locationId,
    ticketTypes: ticketTypes.map((t) => ({
      name: t.name,
      maxAvailable: t.maxAvailable,
    })),
    eventId,
  };
}

export function useStandaloneEventOrganizersState({
  initialOrganizers,
  locationId,
  ticketTypes,
  eventId,
}: {
  initialOrganizers: OrganizerSchema[];
  locationId: string | null | undefined;
  ticketTypes: OrganizerTicketTypeRef[];
  eventId: string;
}): EventOrganizersState {
  const [organizers, setOrganizers] =
    useState<OrganizerSchema[]>(initialOrganizers);
  const [sendOrganizerTicketEmail, setSendOrganizerTicketEmail] =
    useState(false);

  const addOrganizer = useCallback(
    (organizer: OrganizerBaseSchema, number: number, type: InviteCondition) => {
      setOrganizers((current) => {
        if (current.some((o) => o.id === organizer.id)) {
          return current;
        }

        const newOrganizer =
          type === 'TRADITIONAL'
            ? ({
                ...organizer,
                type: 'TRADITIONAL' as const,
                discountPercentage: number,
              } as const)
            : ({
                ...organizer,
                type: 'INVITATION' as const,
                ticketAmount: number,
              } as const);

        return [...current, newOrganizer];
      });
    },
    [],
  );

  const deleteOrganizer = useCallback((organizer: OrganizerBaseSchema) => {
    setOrganizers((current) => current.filter((o) => o.id !== organizer.id));
  }, []);

  const updateOrganizerNumber = useCallback(
    (organizer: OrganizerBaseSchema, number: number, type: InviteCondition) => {
      setOrganizers((current) =>
        current.map((o) =>
          o.id === organizer.id
            ? type === 'TRADITIONAL'
              ? { ...o, discountPercentage: number }
              : { ...o, ticketAmount: number }
            : o,
        ),
      );
    },
    [],
  );

  const updateAllOrganizerNumber = useCallback(
    (number: number, type: InviteCondition) => {
      setOrganizers((current) =>
        current.map((o) =>
          type === 'TRADITIONAL'
            ? { ...o, discountPercentage: number }
            : { ...o, ticketAmount: number },
        ),
      );
    },
    [],
  );

  return {
    organizers,
    addOrganizer,
    deleteOrganizer,
    updateOrganizerNumber,
    updateAllOrganizerNumber,
    sendOrganizerTicketEmail,
    setSendOrganizerTicketEmail,
    locationId,
    ticketTypes,
    eventId,
  };
}
