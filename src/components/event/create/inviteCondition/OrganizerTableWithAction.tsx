import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { DataTable } from '@/components/common/DataTable';
import { SortableColumnHeader } from '@/components/common/table/SortableColumnHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type role } from '@/drizzle/schema';
import { type EventOrganizersState } from '@/lib/event-organizers';
import { roleTranslation } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { trpc } from '@/server/trpc/client';
import { type InviteCondition } from '@/server/types';

type OrganizerTableRowInput = {
  id: string;
  fullName: string;
  dni: string;
  phoneNumber: string;
  role: (typeof role.enumValues)[number];
  number: number;
};

type OrganizerTableData = OrganizerTableRowInput & {
  deliveredCount: number;
  remainingCount: number;
  deliveredPercent: number;
  roleLabel: string;
};

function OrganizerNumberInput({
  row,
  type,
  maxForRow,
  disableActions,
  updateOrganizerNumber,
  showRemaining,
  inputClassName,
}: {
  row: OrganizerTableData;
  type: InviteCondition;
  maxForRow: number;
  disableActions: boolean;
  updateOrganizerNumber: EventOrganizersState['updateOrganizerNumber'];
  showRemaining?: boolean;
  inputClassName?: string;
}) {
  const delivered = row.deliveredCount;
  const assigned = row.number;
  const remaining = row.remainingCount;
  const minValue = type === 'INVITATION' ? Math.max(1, delivered) : 0;

  return (
    <div className='flex items-center gap-2'>
      <Input
        className={cn('w-16 shrink-0', inputClassName)}
        type='number'
        min={minValue}
        max={maxForRow}
        disabled={disableActions}
        value={row.number}
        onChange={(e) => {
          const value = Number(e.target.value);
          const clampedValue = Math.min(Math.max(value, minValue), maxForRow);
          updateOrganizerNumber(row, clampedValue, type);
        }}
      />
      {showRemaining && type === 'INVITATION' && (
        <span className='text-sm text-muted-foreground tabular-nums whitespace-nowrap'>
          ({remaining}/{assigned})
        </span>
      )}
    </div>
  );
}

function columns({
  numberTitle,
  type,
  updateOrganizerNumber,
  deleteOrganizer,
  maxNumber,
  disableActions,
  getMaxForRow,
}: {
  type: InviteCondition;
  numberTitle: string;
  updateOrganizerNumber: EventOrganizersState['updateOrganizerNumber'];
  deleteOrganizer: EventOrganizersState['deleteOrganizer'];
  maxNumber: number;
  disableActions: boolean;
  getMaxForRow: (rowId: string) => number;
}): ColumnDef<OrganizerTableData>[] {
  const showInvitationStats = type === 'INVITATION';

  const baseColumns: ColumnDef<OrganizerTableData>[] = [
    {
      id: 'dni',
      accessorKey: 'dni',
      header: ({ column }) => (
        <SortableColumnHeader column={column} label='DNI' />
      ),
      sortingFn: 'alphanumeric',
      cell: ({ row }) => <div>{row.original.dni}</div>,
    },
    {
      id: 'fullName',
      accessorKey: 'fullName',
      header: ({ column }) => (
        <SortableColumnHeader column={column} label='Nombre' />
      ),
      sortingFn: 'alphanumeric',
      cell: ({ row }) => <div>{row.original.fullName}</div>,
    },
    {
      id: 'role',
      accessorKey: 'roleLabel',
      header: ({ column }) => (
        <SortableColumnHeader column={column} label='Rol' />
      ),
      sortingFn: 'alphanumeric',
      cell: ({ row }) => <div>{row.original.roleLabel}</div>,
    },
  ];

  if (showInvitationStats) {
    baseColumns.push({
      id: 'deliveredTickets',
      accessorKey: 'deliveredCount',
      header: ({ column }) => (
        <SortableColumnHeader column={column} label='Tickets entregados' />
      ),
      sortingFn: (rowA, rowB) =>
        rowA.original.deliveredCount - rowB.original.deliveredCount,
      cell: ({ row }) => (
        <div className='tabular-nums whitespace-nowrap'>
          {row.original.deliveredCount} de {row.original.number} (
          {Math.round(row.original.deliveredPercent * 100)}%)
        </div>
      ),
    });
  }

  baseColumns.push({
    id: 'number',
    header: ({ column }) => (
      <SortableColumnHeader column={column} label={numberTitle} />
    ),
    accessorKey: 'number',
    sortingFn: 'basic',
    size: 200,
    cell: ({ row }) => {
      const maxForThisRow = getMaxForRow(row.original.id);

      return (
        <div className='flex flex-1 items-center justify-between gap-2'>
          <OrganizerNumberInput
            row={row.original}
            type={type}
            maxForRow={maxForThisRow}
            disableActions={disableActions}
            updateOrganizerNumber={updateOrganizerNumber}
            showRemaining={showInvitationStats}
          />
          {!disableActions && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => {
                deleteOrganizer(row.original);
              }}
            >
              <TrashIcon className='w-4 h-4 text-red-500' />
            </Button>
          )}
        </div>
      );
    },
  });

  return baseColumns;
}

export function OrganizerTableWithAction({
  data,
  children,
  numberTitle,
  type,
  maxNumber,
  disableActions = false,
  maxCapacity,
  eventId,
  updateOrganizerNumber,
  deleteOrganizer,
}: {
  data: OrganizerTableRowInput[];
  children: React.ReactNode;
  numberTitle: string;
  type: InviteCondition;
  maxNumber: number;
  disableActions?: boolean;
  maxCapacity?: number;
  eventId?: string;
  updateOrganizerNumber: EventOrganizersState['updateOrganizerNumber'];
  deleteOrganizer: EventOrganizersState['deleteOrganizer'];
}) {
  const { data: deliveredCounts = {} } =
    trpc.events.getOrganizerDeliveredTicketCounts.useQuery(
      { eventId: eventId! },
      { enabled: type === 'INVITATION' && !!eventId },
    );

  // Keep a ref to the latest data to avoid recreating the function
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Función para calcular el máximo dinámico para cada fila
  const getMaxForRow = useCallback(
    (rowId: string) => {
      // En modo TRADITIONAL, usar el máximo fijo
      if (type === 'TRADITIONAL') {
        return maxNumber;
      }

      // En modo INVITATION, calcular dinámicamente
      if (!maxCapacity) {
        return maxNumber;
      }

      const currentData = dataRef.current;
      const totalOrganizers = currentData.length;
      const sumOfAllInputs = currentData.reduce(
        (sum, row) => sum + row.number,
        0,
      );
      const thisRowValue =
        currentData.find((row) => row.id === rowId)?.number || 0;

      // Fórmula: capacidadLocacion - cantidadOrganizadores - sumaDeInputsDeLasOtrasFilas
      // O sea: capacidadLocacion - cantidadOrganizadores - (sumaTotal - valorDeEstaFila)
      const remainingCapacity =
        maxCapacity - totalOrganizers - sumOfAllInputs + thisRowValue;

      return Math.max(0, remainingCapacity);
    },
    [type, maxNumber, maxCapacity],
  );

  const tableData = useMemo<OrganizerTableData[]>(
    () =>
      data.map((row) => {
        const deliveredCount = deliveredCounts[row.id] ?? 0;
        const assigned = row.number;
        const remainingCount = Math.max(0, assigned - deliveredCount);
        const deliveredPercent = assigned > 0 ? deliveredCount / assigned : 0;

        return {
          ...row,
          deliveredCount,
          remainingCount,
          deliveredPercent,
          roleLabel: roleTranslation[row.role],
        };
      }),
    [data, deliveredCounts],
  );

  const memoizedColumns = useMemo(
    () =>
      columns({
        numberTitle,
        type,
        updateOrganizerNumber,
        deleteOrganizer,
        maxNumber,
        disableActions,
        getMaxForRow,
      }),
    [
      numberTitle,
      type,
      updateOrganizerNumber,
      deleteOrganizer,
      maxNumber,
      disableActions,
      getMaxForRow,
    ],
  );

  return (
    <div className='min-w-0'>
      {children}
      <DataTable
        disableExport
        fullWidth={false}
        noResultsPlaceholder={'No seleccionaste ningún organizador'}
        divClassName='mx-0! w-full! max-w-full! overflow-x-auto rounded-tr-none rounded-tl-none sm:rounded-tl-md'
        columns={memoizedColumns}
        data={tableData}
      />
    </div>
  );
}
