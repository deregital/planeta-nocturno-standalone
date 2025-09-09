'use client';

import { type RouterOutputs } from '@/server/routers/app';
import { DataTable } from '@/components/common/DataTable';
import { generateTicketColumns } from '@/components/event/individual/ticketsTable/columns';

export function TicketTableSection({
  tickets,
}: {
  tickets: RouterOutputs['emittedTickets']['getByEventId'];
}) {
  return <DataTable columns={generateTicketColumns()} data={tickets} />;
}
