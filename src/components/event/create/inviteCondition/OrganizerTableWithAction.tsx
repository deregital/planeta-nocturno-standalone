import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon } from 'lucide-react';
import { useMemo, useCallback, useRef, useEffect } from 'react';

import { DataTable } from '@/components/common/DataTable';
import { Input } from '@/components/ui/input';
import { type InviteCondition } from '@/server/types';
import { type CreateEventStore } from '@/app/(backoffice)/admin/event/create/state';
import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { Button } from '@/components/ui/button';

type OrganizerTableData = {
  id: string;
  fullName: string;
  dni: string;
  phoneNumber: string;
  number: number;
};

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
  updateOrganizerNumber: CreateEventStore['updateOrganizerNumber'];
  deleteOrganizer: CreateEventStore['deleteOrganizer'];
  maxNumber: number;
  disableActions: boolean;
  getMaxForRow: (rowId: string) => number;
}): ColumnDef<OrganizerTableData>[] {
  return [
    {
      header: 'DNI',
      accessorKey: 'dni',
      cell: ({ row }) => {
        return <div>{row.original.dni}</div>;
      },
    },
    {
      header: 'Nombre',
      accessorKey: 'fullName',
      cell: ({ row }) => {
        return <div>{row.original.fullName}</div>;
      },
    },
    {
      header: 'Teléfono',
      accessorKey: 'phoneNumber',
      cell: ({ row }) => {
        return <div>{row.original.phoneNumber}</div>;
      },
    },
    {
      header: numberTitle,
      accessorKey: 'number',
      size: 200,
      cell: ({ row }) => {
        const maxForThisRow = getMaxForRow(row.original.id);
        return (
          <div className='flex flex-1 justify-between'>
            <Input
              className='w-fit max-w-fit'
              type='number'
              min={type === 'INVITATION' ? 1 : 0}
              max={maxForThisRow}
              disabled={disableActions}
              value={row.original.number}
              onChange={(e) => {
                const value = Number(e.target.value);
                const clampedValue = Math.min(
                  Math.max(value, 0),
                  maxForThisRow,
                );
                updateOrganizerNumber(row.original, clampedValue, type);
              }}
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
    },
  ];
}

export function OrganizerTableWithAction({
  data,
  children,
  numberTitle,
  type,
  maxNumber,
  disableActions = false,
  maxCapacity,
}: {
  data: OrganizerTableData[];
  children: React.ReactNode;
  numberTitle: string;
  type: InviteCondition;
  maxNumber: number;
  disableActions?: boolean;
  maxCapacity?: number;
}) {
  const updateOrganizerNumber = useCreateEventStore(
    (state) => state.updateOrganizerNumber,
  );
  const deleteOrganizer = useCreateEventStore((state) => state.deleteOrganizer);

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
    <div>
      <div className='flex w-full justify-end'>{children}</div>
      <DataTable
        disableExport
        fullWidth={false}
        noResultsPlaceholder='No seleccionaste ningún organizador'
        divClassName='mx-0! w-full! max-w-full!'
        columns={memoizedColumns}
        data={data}
      />
    </div>
  );
}
