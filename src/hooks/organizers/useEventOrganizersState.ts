'use client';

import { useCallback, useState } from 'react';

import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import {
  rebalanceChiefInvitationOrganizers,
  sumChiefSubordinateInvitationTickets,
} from '@/lib/chief-organizer-event';
import {
  applyAddInvitationOrganizersStealingTickets,
  type EventOrganizersState,
  type InvitationOrganizerCapacityOptions,
  type OrganizerTicketTypeRef,
} from '@/lib/event-organizers';
import {
  type OrganizerBaseSchema,
  type OrganizerInvitationSchema,
  type OrganizerSchema,
} from '@/server/schemas/organizer';
import { type InviteCondition } from '@/server/types';

export function useCreateEventOrganizersState(): EventOrganizersState {
  const organizers = useCreateEventStore((state) => state.organizers);
  const addOrganizer = useCreateEventStore((state) => state.addOrganizer);
  const addInvitationOrganizersStealingTickets = useCreateEventStore(
    (state) => state.addInvitationOrganizersStealingTickets,
  );
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
    addInvitationOrganizersStealingTickets,
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
  chiefOrganizerId,
  chiefInvitationPool,
}: {
  initialOrganizers: OrganizerSchema[];
  locationId: string | null | undefined;
  ticketTypes: OrganizerTicketTypeRef[];
  eventId: string;
  /** Si se define, al cambiar subordinados se ajusta el cupo del jefe dentro del pool. */
  chiefOrganizerId?: string;
  chiefInvitationPool?: number;
}): EventOrganizersState {
  const [organizers, setOrganizers] =
    useState<OrganizerSchema[]>(initialOrganizers);
  const [sendOrganizerTicketEmail, setSendOrganizerTicketEmail] =
    useState(false);

  const applyChiefPoolBalance = useCallback(
    (organizers: OrganizerSchema[]) => {
      if (chiefOrganizerId === undefined || chiefInvitationPool === undefined) {
        return organizers;
      }

      return rebalanceChiefInvitationOrganizers(
        organizers,
        chiefOrganizerId,
        chiefInvitationPool,
      );
    },
    [chiefOrganizerId, chiefInvitationPool],
  );

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

        return applyChiefPoolBalance([...current, newOrganizer]);
      });
    },
    [applyChiefPoolBalance],
  );

  const deleteOrganizer = useCallback(
    (organizer: OrganizerBaseSchema) => {
      setOrganizers((current) =>
        applyChiefPoolBalance(current.filter((o) => o.id !== organizer.id)),
      );
    },
    [applyChiefPoolBalance],
  );

  const updateOrganizerNumber = useCallback(
    (organizer: OrganizerBaseSchema, number: number, type: InviteCondition) => {
      setOrganizers((current) => {
        let nextNumber = number;

        if (
          chiefOrganizerId !== undefined &&
          chiefInvitationPool !== undefined &&
          type === 'INVITATION' &&
          organizer.id !== chiefOrganizerId
        ) {
          const otherSubs = current.filter(
            (o): o is OrganizerInvitationSchema =>
              o.type === 'INVITATION' &&
              o.id !== organizer.id &&
              o.id !== chiefOrganizerId,
          );
          const otherSubsTotal = sumChiefSubordinateInvitationTickets(
            otherSubs,
            chiefOrganizerId,
          );
          nextNumber = Math.min(
            number,
            Math.max(0, chiefInvitationPool - otherSubsTotal),
          );
        }

        return applyChiefPoolBalance(
          current.map((o) =>
            o.id === organizer.id
              ? type === 'TRADITIONAL'
                ? { ...o, discountPercentage: nextNumber }
                : { ...o, ticketAmount: nextNumber }
              : o,
          ),
        );
      });
    },
    [applyChiefPoolBalance, chiefOrganizerId, chiefInvitationPool],
  );

  const updateAllOrganizerNumber = useCallback(
    (number: number, type: InviteCondition) => {
      setOrganizers((current) =>
        applyChiefPoolBalance(
          current.map((o) =>
            type === 'TRADITIONAL'
              ? { ...o, discountPercentage: number }
              : o.id === chiefOrganizerId
                ? o
                : { ...o, ticketAmount: number },
          ),
        ),
      );
    },
    [applyChiefPoolBalance, chiefOrganizerId],
  );

  const addInvitationOrganizersStealingTickets = useCallback(
    (
      organizersToAdd: OrganizerBaseSchema[],
      capacity: InvitationOrganizerCapacityOptions,
    ) => {
      let success = false;
      setOrganizers((current) => {
        const result = applyAddInvitationOrganizersStealingTickets(
          current,
          organizersToAdd,
          capacity,
        );
        if ('error' in result) {
          return current;
        }
        success = true;
        return applyChiefPoolBalance(result.organizers);
      });
      return success;
    },
    [applyChiefPoolBalance],
  );

  return {
    organizers,
    addOrganizer,
    addInvitationOrganizersStealingTickets,
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
