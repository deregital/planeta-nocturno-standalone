'use client';
import { DataTable } from './DataTable';
import { generateTicketColumns } from './columns';
import { type RouterOutputs } from '@/server/routers/app';

export function TicketTableSection({
  tickets,
}: {
  tickets: RouterOutputs['emittedTickets']['getByEventId'];
}) {
  return <DataTable columns={generateTicketColumns()} data={tickets} />;
}
