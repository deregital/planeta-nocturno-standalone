import { CircleDollarSign } from 'lucide-react';
import { type ReactNode } from 'react';

import FreeIcon from '@/components/icons/FreeIcon';
import TableBar from '@/components/icons/TableBar';
import { type role as roleEnum } from '@/drizzle/schema';
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

export const roleTranslation: Record<
  (typeof roleEnum.enumValues)[number],
  string
> = {
  ADMIN: 'Administrador',
  TICKETING: 'Boletería',
};
