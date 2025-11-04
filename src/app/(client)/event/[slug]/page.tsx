import { notFound, redirect } from 'next/navigation';

import Client from '@/app/(client)/event/[slug]/client';
import ServerErrorCard from '@/components/common/ServerErrorCard';
import { trpc } from '@/server/trpc/server';
import { INVITE_CODE_QUERY_PARAM } from '@/server/utils/constants';

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
  }

  return <Client event={event} />;
}

export default EventPage;
