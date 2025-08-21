import FreeIcon from '@/components/icons/FreeIcon';
import TableBar from '@/components/icons/TableBar';
import { type TicketTypeCategory } from '@/server/types';
import { CircleDollarSign } from 'lucide-react';
import { type ReactNode } from 'react';

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
