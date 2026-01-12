'use client';

import { DataTable } from '@/components/common/DataTable';
import { generateTicketColumns } from '@/components/event/individual/ticketsTable/columns';
import { type RouterOutputs } from '@/server/routers/app';

export function TicketTableSection({
  tickets,
  isAdmin = false,
  headerActions,
}: {
  tickets: RouterOutputs['emittedTickets']['getByEventId'];
  isAdmin?: boolean;
  headerActions?: React.ReactNode;
}) {
  return (
    <DataTable
      columns={generateTicketColumns(isAdmin)}
      data={tickets}
      exportExcludeColumnIds={['actions']}
      exportFileName={'Tickets'}
      headerActions={headerActions}
    />
  );
}
