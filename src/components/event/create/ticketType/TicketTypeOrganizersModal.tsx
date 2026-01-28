import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon, UserPen } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { type EventState } from '@/app/(backoffice)/admin/event/create/state';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { VirtualizedCombobox } from '@/components/ui/virtualized-combobox';
import { type role } from '@/drizzle/schema';
import { roleTranslation } from '@/lib/translations';
import { trpc } from '@/server/trpc/client';

type OrganizerTableData = {
  id: string;
  fullName: string;
  dni: string;
  role: (typeof role.enumValues)[number];
};

function createColumns(
  onRemove: (id: string) => void,
): ColumnDef<OrganizerTableData>[] {
  return [
    {
      header: 'DNI',
      accessorKey: 'dni',
    },
    {
      header: 'Nombre',
      accessorKey: 'fullName',
    },
    {
      header: 'Rol',
      accessorKey: 'role',
      cell: ({ row }) => roleTranslation[row.original.role],
    },
    {
      header: '',
      id: 'actions',
      size: 50,
      cell: ({ row }) => (
        <Button
          variant='ghost'
          size='sm'
          onClick={() => onRemove(row.original.id)}
        >
          <TrashIcon className='w-4 h-4 text-red-500' />
        </Button>
      ),
    },
  ];
}

type TicketTypeOrganizersModalProps = {
  ticketType: EventState['ticketTypes'][number];
};

export default function TicketTypeOrganizersModal({
  ticketType,
}: TicketTypeOrganizersModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedComboboxOption, setSelectedComboboxOption] = useState('');

  // Usar los organizadores asignados al evento desde el store
  const eventOrganizers = useCreateEventStore((state) => state.organizers);
  const updateTicketType = useCreateEventStore(
    (state) => state.updateTicketType,
  );

  // Obtener datos completos de organizadores para relaciones chief-organizer
  const { data: allOrganizersData } = trpc.user.getOrganizers.useQuery();

  // IDs de los organizadores del evento para filtrar
  const eventOrganizerIds = useMemo(
    () => eventOrganizers.map((org) => org.id),
    [eventOrganizers],
  );

  // IDs de organizadores actualmente asignados a este ticketType
  const assignedOrganizerIds = useMemo(() => {
    return ticketType.organizers ?? [];
  }, [ticketType.organizers]);

  // Función para eliminar un organizador
  const handleRemoveOrganizer = (organizerId: string) => {
    if (!ticketType.id) return;

    const newOrganizers = assignedOrganizerIds.filter(
      (id) => id !== organizerId,
    );
    updateTicketType(ticketType.id, {
      ...ticketType,
      organizers: newOrganizers.length > 0 ? newOrganizers : null,
    });
  };

  // Organizadores asignados con su información completa para la tabla
  const assignedOrganizers = useMemo((): OrganizerTableData[] => {
    return eventOrganizers
      .filter((org) => assignedOrganizerIds.includes(org.id))
      .map((org) => ({
        id: org.id,
        fullName: org.fullName,
        dni: org.dni,
        role: org.role,
      }));
  }, [eventOrganizers, assignedOrganizerIds]);

  const columns = useMemo(
    () => createColumns(handleRemoveOrganizer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignedOrganizerIds, ticketType.id],
  );

  // Opciones para el combobox (organizadores del evento no asignados a este ticketType)
  const organizerOptions = useMemo(() => {
    const selectableOrganizers = eventOrganizers.filter(
      (organizer) =>
        organizer.role === 'ORGANIZER' &&
        !assignedOrganizerIds.includes(organizer.id),
    );

    return selectableOrganizers.map((organizer) => ({
      value: organizer.id,
      label: `${organizer.fullName} - ${organizer.dni}`,
    }));
  }, [eventOrganizers, assignedOrganizerIds]);

  // Opciones agrupadas (tags y jefes de organizadores)
  const groupedOptions = useMemo(() => {
    const groups = [];

    // Grupo de Tags - solo de organizadores del evento
    if (allOrganizersData) {
      // Obtener organizadores del evento con sus tags
      const eventOrganizersWithTags = allOrganizersData.filter(
        (org) =>
          org.role === 'ORGANIZER' &&
          eventOrganizerIds.includes(org.id) &&
          !assignedOrganizerIds.includes(org.id),
      );

      // Agrupar por tags
      const tagGroups = new Map<
        string,
        { name: string; organizerIds: string[] }
      >();

      eventOrganizersWithTags.forEach((organizer) => {
        organizer.userXTags?.forEach((userXTag) => {
          const tag = userXTag.tag;
          if (!tagGroups.has(tag.id)) {
            tagGroups.set(tag.id, { name: tag.name, organizerIds: [] });
          }
          tagGroups.get(tag.id)!.organizerIds.push(organizer.id);
        });
      });

      if (tagGroups.size > 0) {
        const tagOptions = Array.from(tagGroups.entries()).map(
          ([tagId, tagData]) => ({
            value: `tag:${tagId}`,
            label: `🏷️ ${tagData.name} (${tagData.organizerIds.length} organizador${tagData.organizerIds.length > 1 ? 'es' : ''})`,
          }),
        );

        groups.push({
          group: 'Tags',
          options: tagOptions,
        });
      }
    }

    // Grupo de Jefes de Organizadores
    const selectableChiefs = eventOrganizers.filter(
      (organizer) =>
        organizer.role === 'CHIEF_ORGANIZER' &&
        !assignedOrganizerIds.includes(organizer.id),
    );

    if (selectableChiefs.length > 0) {
      const chiefOptions = selectableChiefs.map((chief) => {
        // Contar organizadores relacionados con este jefe que están en el evento y no asignados
        const relatedCount = allOrganizersData
          ? allOrganizersData.filter(
              (org) =>
                org.role === 'ORGANIZER' &&
                org.chiefOrganizerId === chief.id &&
                eventOrganizerIds.includes(org.id) &&
                !assignedOrganizerIds.includes(org.id),
            ).length
          : 0;

        return {
          value: `chief:${chief.id}`,
          label: `👤 ${chief.fullName} - ${chief.dni}${relatedCount > 0 ? ` (${relatedCount} organizador${relatedCount > 1 ? 'es' : ''})` : ''}`,
        };
      });

      groups.push({
        group: roleTranslation['CHIEF_ORGANIZER'],
        options: chiefOptions,
      });
    }

    return groups.length > 0 ? groups : undefined;
  }, [
    eventOrganizers,
    assignedOrganizerIds,
    allOrganizersData,
    eventOrganizerIds,
  ]);

  // Función para agregar organizador(es)
  const handleAddOrganizers = (organizerIds: string[]) => {
    if (!ticketType.id) return;

    const newOrganizers = [...assignedOrganizerIds, ...organizerIds];
    updateTicketType(ticketType.id, {
      ...ticketType,
      organizers: newOrganizers,
    });
  };

  // Handler del combobox
  const handleSelectOption = (option: string) => {
    if (option.startsWith('tag:')) {
      const tagId = option.replace('tag:', '');

      // Buscar todos los organizadores con este tag que están en el evento
      const organizersWithTag = allOrganizersData
        ? allOrganizersData
            .filter(
              (org) =>
                org.role === 'ORGANIZER' &&
                eventOrganizerIds.includes(org.id) &&
                !assignedOrganizerIds.includes(org.id) &&
                org.userXTags?.some((userXTag) => userXTag.tag.id === tagId),
            )
            .map((org) => org.id)
        : [];

      if (organizersWithTag.length > 0) {
        handleAddOrganizers(organizersWithTag);
      }
    } else if (option.startsWith('chief:')) {
      const chiefId = option.replace('chief:', '');

      // Buscar todos los organizadores relacionados con este jefe que están en el evento
      const relatedOrganizerIds = allOrganizersData
        ? allOrganizersData
            .filter(
              (org) =>
                org.role === 'ORGANIZER' &&
                org.chiefOrganizerId === chiefId &&
                eventOrganizerIds.includes(org.id) &&
                !assignedOrganizerIds.includes(org.id),
            )
            .map((org) => org.id)
        : [];

      // Agregar el jefe y todos sus organizadores relacionados
      const idsToAdd = [
        ...(assignedOrganizerIds.includes(chiefId) ? [] : [chiefId]),
        ...relatedOrganizerIds,
      ];

      if (idsToAdd.length > 0) {
        handleAddOrganizers(idsToAdd);
      }
    } else {
      // Es un organizador individual
      handleAddOrganizers([option]);
    }

    setSelectedComboboxOption('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost'>
          <UserPen />
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-xl! md:max-w-3xl! w-full'>
        <DialogHeader>
          <DialogTitle>Organizadores del ticket</DialogTitle>
          <DialogDescription>
            Selecciona los organizadores que pueden vender este tipo de ticket.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          <VirtualizedCombobox
            searchPlaceholder='Buscar organizador del evento...'
            notFoundPlaceholder='No hay más organizadores disponibles'
            options={organizerOptions}
            groupedOptions={groupedOptions}
            selectedOption={selectedComboboxOption}
            onSelectedOptionChange={setSelectedComboboxOption}
            onSelectOption={handleSelectOption}
            showSelectedOptions={false}
            width='100%'
          />

          <DataTable
            disableExport
            fullWidth={false}
            noResultsPlaceholder='No hay organizadores asignados. Todos los organizadores podrán vender este ticket.'
            divClassName='mx-0! w-full! max-w-full!'
            columns={columns}
            data={assignedOrganizers}
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button>Aceptar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
