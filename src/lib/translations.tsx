import { CircleDollarSign } from 'lucide-react';
import { type ReactNode } from 'react';

import FreeIcon from '@/components/icons/FreeIcon';
import TableBar from '@/components/icons/TableBar';
import { type inviteCondition } from '@/drizzle/schema';
import { type AppRole } from '@/lib/auth/roles';
import { type TicketTypeCategory } from '@/server/types';

export const ticketTypesTranslation: Record<
  TicketTypeCategory,
  { text: string; icon: ReactNode }
> = {
  FREE: { text: 'Free', icon: <FreeIcon /> },
  PAID: {
    text: 'Pago',
    icon: <CircleDollarSign />,
  },
  TABLE: { text: 'Mesa', icon: <TableBar /> },
};

export const genderTranslation: Record<'male' | 'female' | 'other', string> = {
  female: 'Femenino',
  male: 'Masculino',
  other: 'Otro',
};

export const roleTranslation: Record<AppRole, string> = {
  CONTROL_ADMIN: 'Administrador central',
  ADMIN: 'Administrador',
  TICKETING: 'Acceso',
  CONTROL_TICKETING: 'Control',
  ORGANIZER: 'Organizador',
  CHIEF_ORGANIZER: 'Jefe de Organizadores',
};

export const inviteConditionTranslation: Record<
  (typeof inviteCondition.enumValues)[number],
  string
> = {
  TRADITIONAL: 'Tradicional',
  INVITATION: 'Invitación',
  SIMPLE: 'Simple',
};
