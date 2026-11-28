'use client';

import { verifyInvitationHolder } from '@/app/(client)/tickets/[slug]/access-actions';
import TicketHolderVerify from '@/app/(client)/tickets/[slug]/verify';

export default function InvitationTicketVerify({
  eventSlug,
  code,
}: {
  eventSlug: string;
  code: string;
}) {
  return (
    <TicketHolderVerify
      title='Esta invitación ya fue canjeada'
      description='Si la canjeaste vos, ingresá tu DNI (el que cargaste al canjearla) para ver tu ticket.'
      invalidMessage='Ese DNI no es el que se cargó al canjear esta invitación. Si no la canjeaste vos, pedile una nueva a quien te la mandó.'
      verify={(dni) => verifyInvitationHolder(eventSlug, code, dni)}
    />
  );
}
