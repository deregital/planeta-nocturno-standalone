'use client';

import { DataTable } from '@/components/common/DataTable';
import { generateTicketColumns } from '@/components/event/individual/ticketsTable/columns';
import { type RouterOutputs } from '@/server/routers/app';
import { type TicketScope } from '@/lib/rbac/permissions';
import { type InviteCondition } from '@/server/types';

export function TicketTableSection({
  tickets,
  scope,
  headerActions,
  event,
}: {
  tickets: RouterOutputs['emittedTickets']['getByEventId'];
  scope: TicketScope;
  headerActions?: React.ReactNode;
  event: {
    inviteCondition: InviteCondition;
    hasSimpleInvitation: boolean;
    hasQuestions?: boolean;
  };
}) {
  return (
    <DataTable
      columns={generateTicketColumns({ scope, event })}
      data={tickets}
      exportExcludeColumnIds={['actions']}
      exportFileName={'Tickets'}
      headerActions={headerActions}
    />
  );
}
