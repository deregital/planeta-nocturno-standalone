'use client';

import { type RouterOutputs } from '@/server/routers/app';
import { DataTable } from '@/components/common/DataTable';
import { generateTicketColumns } from '@/components/event/individual/ticketsTable/columns';

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
    />
  );
}
