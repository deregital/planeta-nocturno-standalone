import type { Metadata } from 'next';

import InvitationTicketVerify from '@/app/(client)/event/[slug]/ticket/client';
import ServerErrorCard from '@/components/common/ServerErrorCard';
import { INVITE_CODE_QUERY_PARAM } from '@/server/utils/constants';

export const metadata: Metadata = {
  title: 'Ver mi ticket',
  robots: { index: false, follow: false },
};

interface InvitationTicketPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InvitationTicketPage({
  params,
  searchParams,
}: InvitationTicketPageProps) {
  const { slug } = await params;
  const code = (await searchParams)[INVITE_CODE_QUERY_PARAM];

  // No se consulta la base acá: la validación (con rate limit) la hace la
  // mutación al enviar el DNI, así la página no revela si el código existe.
  if (typeof code !== 'string' || !/^[0-9A-Fa-f]{6}$/.test(code.trim())) {
    return (
      <ServerErrorCard
        title='Enlace inválido'
        description='El enlace de tu invitación no es válido. Abrilo nuevamente desde el mensaje que recibiste.'
        route='/'
      />
    );
  }

  return <InvitationTicketVerify eventSlug={slug} code={code.trim()} />;
}
