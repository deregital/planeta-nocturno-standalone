'use client';

import { DataTable } from '@/components/common/DataTable';
import { generateTicketColumns } from '@/components/event/individual/ticketsTable/columns';
import { type RouterOutputs } from '@/server/routers/app';

export function TicketTableSection({
  tickets,
  highlightedTicketId,
  isAdmin = false,
}: {
  tickets: RouterOutputs['emittedTickets']['getByEventId'];
  highlightedTicketId?: string | null;
  isAdmin?: boolean;
}) {
  return (
    <DataTable
      columns={generateTicketColumns(isAdmin)}
      data={tickets}
      highlightedRowId={highlightedTicketId}
      exportExcludeColumnIds={['actions']}
      exportFileName={'Tickets'}
    />
  );
}
