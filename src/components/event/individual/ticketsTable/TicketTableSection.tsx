'use client';

import { DataTable } from '@/components/common/DataTable';
import { generateTicketColumns } from '@/components/event/individual/ticketsTable/columns';
import { type RouterOutputs } from '@/server/routers/app';
import { type Role } from '@/server/types';

export function TicketTableSection({
  tickets,
  role,
  headerActions,
}: {
  tickets: RouterOutputs['emittedTickets']['getByEventId'];
  role: Role;
  headerActions?: React.ReactNode;
}) {
  return (
    <DataTable
      columns={generateTicketColumns(role)}
      data={tickets}
      exportExcludeColumnIds={['actions']}
      exportFileName={'Tickets'}
      headerActions={headerActions}
    />
  );
}
