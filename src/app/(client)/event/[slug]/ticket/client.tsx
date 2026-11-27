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
      title='Tu invitación ya tiene un ticket'
      description='Para verlo, ingresá el DNI de la persona titular del ticket.'
      invalidMessage='El DNI no coincide con el del titular de esta invitación.'
      verify={(dni) => verifyInvitationHolder(eventSlug, code, dni)}
    />
  );
}
