'use client';

import { Loader2, Ticket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { EventOrganizersContent } from '@/components/event/create/inviteCondition/EventOrganizers';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useStandaloneEventOrganizersState } from '@/hooks/organizers/useEventOrganizersState';
import { mapEventOrganizersToSchema } from '@/lib/event-organizers';
import { type RouterOutputs } from '@/server/routers/app';
import { type OrganizerSchema } from '@/server/schemas/organizer';
import { trpc } from '@/server/trpc/client';
import { type InviteCondition } from '@/server/types';

type EventForDistribution = RouterOutputs['events']['getBySlug'];

function OrganizerDistributionSaveButton({
  event,
  organizers,
  sendOrganizerTicketEmail,
  onSuccess,
}: {
  event: NonNullable<EventForDistribution>;
  organizers: OrganizerSchema[];
  sendOrganizerTicketEmail: boolean;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateEvent = trpc.events.update.useMutation({
    onSuccess: () => {
      toast.success('Tickets para organizadores actualizados');
      router.refresh();
      onSuccess();
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast.error(
        error.message ||
          'Error al actualizar los tickets para organizadores. Por favor, intente nuevamente.',
      );
      setIsSubmitting(false);
    },
  });

  function handleSave() {
    if (event.inviteCondition === 'INVITATION' && organizers.length === 0) {
      toast.error('Debe agregar al menos un organizador para el evento.');
      return;
    }

    setIsSubmitting(true);
    updateEvent.mutate({
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        coverImageUrl: event.coverImageUrl,
        startingDate: new Date(event.startingDate),
        endingDate: new Date(event.endingDate),
        minAge: event.minAge,
        isActive: event.isActive,
        slug: event.slug,
        locationId: event.locationId,
        categoryId: event.categoryId,
        extraTicketData: event.extraTicketData,
        serviceFee: event.serviceFee,
        emailNotification: event.emailNotification,
        ticketSlugVisibleInPdf: event.ticketSlugVisibleInPdf,
        hasSimpleInvitation: event.hasSimpleInvitation,
        inviteCondition: event.inviteCondition as InviteCondition,
        authorizedUsers: event.eventXUsers.map((e) => ({
          id: e.user.id,
          name: e.user.name,
        })),
      },
      ticketTypes: event.ticketTypes.map((t) => ({
        ...t,
        startingDate: new Date(t.startingDate),
        maxSellDate: t.maxSellDate ? new Date(t.maxSellDate) : new Date(),
        scanLimit: t.scanLimit ? new Date(t.scanLimit) : new Date(),
        organizers:
          'ticketTypeXOrganizers' in t && t.ticketTypeXOrganizers
            ? t.ticketTypeXOrganizers.map((rel) => rel.b)
            : null,
      })),
      organizersInput: organizers,
      sendOrganizerTicketEmail,
    });
  }

  return (
    <Button onClick={handleSave} disabled={isSubmitting}>
      {isSubmitting ? <Loader2 className='size-4 animate-spin' /> : 'Guardar'}
    </Button>
  );
}

function OrganizerDistributionDialogBody({
  event,
  onSuccess,
}: {
  event: NonNullable<EventForDistribution>;
  onSuccess: () => void;
}) {
  const initialOrganizers = useMemo(
    () =>
      mapEventOrganizersToSchema(
        event.eventXorganizers,
        event.inviteCondition as InviteCondition,
      ),
    [event.eventXorganizers, event.inviteCondition],
  );

  const ticketTypes = useMemo(
    () =>
      event.ticketTypes.map((t) => ({
        name: t.name,
        maxAvailable: t.maxAvailable,
      })),
    [event.ticketTypes],
  );

  const organizersState = useStandaloneEventOrganizersState({
    initialOrganizers,
    locationId: event.locationId,
    ticketTypes,
    eventId: event.id,
  });

  return (
    <>
      <EventOrganizersContent
        type='INVITATION'
        showSendEmailOption={false}
        {...organizersState}
      />
      <DialogFooter className='mt-4'>
        <OrganizerDistributionSaveButton
          event={event}
          organizers={organizersState.organizers}
          sendOrganizerTicketEmail={organizersState.sendOrganizerTicketEmail}
          onSuccess={onSuccess}
        />
      </DialogFooter>
    </>
  );
}

export function OrganizerDistribution({
  event,
}: {
  event: NonNullable<EventForDistribution>;
}) {
  const [open, setOpen] = useState(false);

  if (event.inviteCondition !== 'INVITATION') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline'>
          Redistribuir tickets <Ticket />
        </Button>
      </DialogTrigger>
      <DialogContent className='flex max-h-[min(90vh,100dvh)] w-full max-w-[calc(100vw-1rem)] flex-col overflow-x-hidden overflow-y-auto sm:max-w-2xl md:max-w-3xl lg:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>Redistribuir tickets</DialogTitle>
        </DialogHeader>
        {open && (
          <OrganizerDistributionDialogBody
            event={event}
            onSuccess={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
