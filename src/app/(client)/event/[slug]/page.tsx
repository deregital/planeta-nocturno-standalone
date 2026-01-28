import { notFound, redirect } from 'next/navigation';
import { isAfter } from 'date-fns';
import { type Route } from 'next';

import Client from '@/app/(client)/event/[slug]/client';
import ServerErrorCard from '@/components/common/ServerErrorCard';
import { trpc } from '@/server/trpc/server';
import {
  INVITE_CODE_QUERY_PARAM,
  ORGANIZER_TICKET_TYPE_NAME,
  TICKET_TYPE_SLUG_QUERY_PARAM,
} from '@/server/utils/constants';

interface EventPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}

async function EventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const event = await trpc.events.getBySlug(slug);

  if (!event) {
    notFound();
  }

  let filteredEvent = event;

  // Si el evento está en modo INVITATION, validar el código
  if (event.inviteCondition === 'INVITATION') {
    const invitationCode = resolvedSearchParams[INVITE_CODE_QUERY_PARAM];
    const error = resolvedSearchParams.error;

    // Manejar errores de la validación
    if (error === 'missing_code') {
      return (
        <ServerErrorCard
          title='Código de invitación requerido'
          description='Este evento requiere un código de invitación válido para acceder. Por favor, accedé al evento a través del enlace proporcionado por el organizador.'
          route='/'
        />
      );
    }

    if (error === 'invalid_code') {
      return (
        <ServerErrorCard
          title='Código de invitación inválido'
          description='El código de invitación proporcionado no es válido para este evento o no está asignado. Por favor, verificá el código e intentá nuevamente.'
          route='/'
        />
      );
    }

    if (error === 'code_already_used') {
      return (
        <ServerErrorCard
          title='Código ya utilizado'
          description='Este código de invitación ya fue utilizado anteriormente. Cada código solo puede ser usado una vez.'
          route='/'
        />
      );
    }

    if (error === 'invalid_configuration') {
      return (
        <ServerErrorCard
          title='Error en la configuración del evento'
          description='Este evento no tiene un único tipo de ticket configurado (excluyendo el ticket de organizador). Por favor, contactá al organizador.'
          route='/'
        />
      );
    }

    if (error === 'event_not_found') {
      return (
        <ServerErrorCard
          title='Evento no encontrado'
          description='El evento no existe o no se pudo encontrar.'
          route='/'
        />
      );
    }

    // Si hay código de invitación, redirigir al Route Handler API para procesarlo
    if (invitationCode && typeof invitationCode === 'string') {
      redirect(`/api/event/${slug}/invite?invite=${invitationCode}`);
    }

    // Si no hay código en los searchParams, mostrar error
    if (!invitationCode) {
      return (
        <ServerErrorCard
          title='Código de invitación requerido'
          description='Este evento requiere un código de invitación válido para acceder. Por favor, accedé al evento a través del enlace proporcionado por el organizador.'
          route='/'
        />
      );
    }
  } else if (event.inviteCondition === 'TRADITIONAL') {
    let filteredTicketTypes = event.ticketTypes;
    // Obtener los ticketType del searchParams
    const ticketSlugParam = resolvedSearchParams[TICKET_TYPE_SLUG_QUERY_PARAM];
    if (ticketSlugParam) {
      const ticketSlugs = Array.isArray(ticketSlugParam)
        ? ticketSlugParam
        : ticketSlugParam.split(',').map((s) => s.trim());

      // Filtrar los ticketTypes que coincidan con con los del searchParams
      const matchedTicketTypes = event.ticketTypes.filter((ticketType) =>
        ticketSlugs.includes(ticketType.slug),
      );

      // Excluir el ticketType de organizador
      filteredTicketTypes = matchedTicketTypes.filter(
        (ticketType) =>
          ticketType.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim(),
      );

      // Si no se encontraron tickets válidos (si es de organizador), mostrar error
      if (filteredTicketTypes.length === 0 && matchedTicketTypes.length > 0) {
        return (
          <ServerErrorCard
            title='Tipo de ticket no disponible'
            description='El tipo de ticket que intentas acceder no está disponible para compra pública.'
            route={`/event/${event.slug}` as Route}
          />
        );
      }
    }

    filteredTicketTypes = filteredTicketTypes.filter(
      (ticketType) =>
        ticketType.visibleInWeb &&
        ticketType.maxSellDate &&
        isAfter(new Date(ticketType.maxSellDate), new Date()),
    );

    filteredEvent = {
      ...event,
      ticketTypes: filteredTicketTypes,
    };
  }

  return <Client event={filteredEvent} />;
}

export default EventPage;
