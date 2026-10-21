import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DataTable } from '@/components/common/DataTable';
import { SortableColumnHeader } from '@/components/common/table/SortableColumnHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type role } from '@/drizzle/schema';
import {
  buildInvitationTicketEditLimits,
  type EventOrganizersState,
  getInvitationHolderMax,
  getInvitationMaxTicketsForOrganizer,
  type InvitationTicketEditLimits,
  type InvitationTicketHolder,
} from '@/lib/event-organizers';
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
  getTicketLimits,
}: {
  row: OrganizerTableData;
  type: InviteCondition;
  maxForRow: number;
  disableActions: boolean;
  updateOrganizerNumber: EventOrganizersState['updateOrganizerNumber'];
  showRemaining?: boolean;
  inputClassName?: string;
  getTicketLimits?: () => InvitationTicketEditLimits | undefined;
}) {
  const delivered = row.deliveredCount;
  const assigned = row.number;
  const remaining = row.remainingCount;
  const minValue = type === 'INVITATION' ? Math.max(1, delivered) : 0;
  const upperBound = Math.max(maxForRow, minValue);
  const [inputValue, setInputValue] = useState(String(row.number));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setInputValue(String(row.number));
    }
  }, [row.id, row.number]);

  const commitValue = (raw: string, syncInputToCommitted = false) => {
    if (raw === '') return;

    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;

    const clampedValue = Math.min(Math.max(parsed, minValue), upperBound);
    updateOrganizerNumber(row, clampedValue, type, getTicketLimits?.());

    if (syncInputToCommitted) {
      setInputValue(String(clampedValue));
    }
  };

  return (
    <div
      className='flex items-center gap-2'
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        className={cn('w-16 shrink-0', inputClassName)}
        type='number'
        disabled={disableActions}
        min={minValue}
        max={upperBound}
        value={inputValue}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={(e) => {
          isFocusedRef.current = false;
          const raw = e.currentTarget.value;
          if (raw === '') {
            setInputValue(String(minValue));
            updateOrganizerNumber(row, minValue, type, getTicketLimits?.());
            return;
          }
          commitValue(raw, true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setInputValue(raw);

          // Escribir no guarda en cada tecla: si no, la tabla se rearma y se pierde el foco.
          const inputType =
            e.nativeEvent instanceof InputEvent ? e.nativeEvent.inputType : '';
          const isTyping =
            inputType === 'insertText' ||
            inputType === 'deleteContentBackward' ||
            inputType === 'deleteContentForward' ||
            inputType === 'insertFromPaste' ||
            inputType === 'deleteByCut';

          if (!isTyping) {
            commitValue(raw);
          }
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
  disableActions,
  getMaxForRow,
  getTicketLimits,
}: {
  type: InviteCondition;
  numberTitle: string;
  updateOrganizerNumber: EventOrganizersState['updateOrganizerNumber'];
  deleteOrganizer: EventOrganizersState['deleteOrganizer'];
  disableActions: boolean;
  getMaxForRow: (rowId: string) => number;
  getTicketLimits?: () => InvitationTicketEditLimits | undefined;
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
            getTicketLimits={getTicketLimits}
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
  capacityData,
  children,
  numberTitle,
  type,
  maxNumber,
  disableActions = false,
  maxCapacity,
  usesTicketPool = false,
  redistributeAssignedTickets = false,
  reservedOrganizerId,
  eventId,
  updateOrganizerNumber,
  deleteOrganizer,
}: {
  data: OrganizerTableRowInput[];
  capacityData?: OrganizerTableRowInput[];
  children: React.ReactNode;
  numberTitle: string;
  type: InviteCondition;
  maxNumber: number;
  disableActions?: boolean;
  maxCapacity?: number;
  usesTicketPool?: boolean;
  /** Mueve tickets no entregados entre organizadores, en vez de partir el total. */
  redistributeAssignedTickets?: boolean;
  /** Jefe: sus tickets ya entregados no se pueden repartir. */
  reservedOrganizerId?: string;
  eventId?: string;
  updateOrganizerNumber: EventOrganizersState['updateOrganizerNumber'];
  deleteOrganizer: EventOrganizersState['deleteOrganizer'];
}) {
  const { data: deliveredCounts = {}, isSuccess: deliveredLoaded } =
    trpc.events.getOrganizerDeliveredTicketCounts.useQuery(
      { eventId: eventId! },
      { enabled: type === 'INVITATION' && !!eventId },
    );
  const canMoveUndeliveredTickets =
    redistributeAssignedTickets && (!eventId || deliveredLoaded);

  // Ref actualizada en el render para que el máximo use los números recién editados.
  const dataRef = useRef(data);
  const capacityDataRef = useRef(capacityData ?? data);
  dataRef.current = data;
  capacityDataRef.current = capacityData ?? data;

  const deliveredCountsRef = useRef(deliveredCounts);
  deliveredCountsRef.current = deliveredCounts;

  const getTicketLimits = useCallback(() => {
    if (!canMoveUndeliveredTickets || !maxCapacity) return undefined;

    return buildInvitationTicketEditLimits({
      holderIds: capacityDataRef.current.map((row) => row.id),
      deliveredByOrganizerId: deliveredCountsRef.current,
      maxCapacity,
      usesTicketPool,
      balanceHolderId: reservedOrganizerId,
    });
  }, [
    canMoveUndeliveredTickets,
    maxCapacity,
    usesTicketPool,
    reservedOrganizerId,
  ]);

  // Máximo de cada fila: en redistribución, todo lo que no está clavado en otros.
  const getMaxForRow = useCallback(
    (rowId: string) => {
      if (type === 'TRADITIONAL') {
        return maxNumber;
      }

      if (!maxCapacity) {
        return maxNumber;
      }

      const currentData = capacityDataRef.current;
      const assignedTickets = currentData.reduce(
        (sum, row) => sum + row.number,
        0,
      );
      const thisOrganizerTickets =
        dataRef.current.find((row) => row.id === rowId)?.number ??
        currentData.find((row) => row.id === rowId)?.number ??
        0;

      const limits = getTicketLimits();
      if (!limits) {
        return getInvitationMaxTicketsForOrganizer({
          maxCapacity,
          usesTicketPool,
          organizerCount: currentData.length,
          assignedTickets,
          thisOrganizerTickets,
        });
      }

      const holders: InvitationTicketHolder[] = currentData.map((row) => ({
        id: row.id,
        tickets: row.number,
        locked: limits.lockedByOrganizerId[row.id] ?? 1,
      }));

      return getInvitationHolderMax({
        holders,
        holderId: rowId,
        maxCapacity,
        seatCount: usesTicketPool ? 0 : holders.length,
        reservedTickets: limits.reservedTickets,
      });
    },
    [type, maxNumber, maxCapacity, usesTicketPool, getTicketLimits],
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
        disableActions,
        getMaxForRow,
        getTicketLimits,
      }),
    [
      numberTitle,
      type,
      updateOrganizerNumber,
      deleteOrganizer,
      disableActions,
      getMaxForRow,
      getTicketLimits,
    ],
  );

  return (
    <div className='w-full min-w-0 max-w-full'>
      {children}
      <DataTable
        disableExport
        fullWidth={false}
        noResultsPlaceholder={'No seleccionaste ningún organizador'}
        divClassName='mx-0! w-full! max-w-full! rounded-tr-none rounded-tl-none sm:rounded-tl-md'
        columns={memoizedColumns}
        data={tableData}
      />
    </div>
  );
}
