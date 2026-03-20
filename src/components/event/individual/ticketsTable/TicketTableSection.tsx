'use client';

import { DataTable } from '@/components/common/DataTable';
import { generateTicketColumns } from '@/components/event/individual/ticketsTable/columns';
import { type RouterOutputs } from '@/server/routers/app';
import { type InviteCondition, type Role } from '@/server/types';

export function TicketTableSection({
  tickets,
  role,
  headerActions,
  inviteCondition,
}: {
  tickets: RouterOutputs['emittedTickets']['getByEventId'];
  role: Role;
  headerActions?: React.ReactNode;
  inviteCondition: InviteCondition;
}) {
  return (
    <DataTable
      columns={generateTicketColumns({ role, inviteCondition })}
      data={tickets}
      exportExcludeColumnIds={['actions']}
      exportFileName={'Tickets'}
      headerActions={headerActions}
    />
  );
}
