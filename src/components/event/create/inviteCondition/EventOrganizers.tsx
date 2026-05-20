import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { OrganizerTableWithAction } from '@/components/event/create/inviteCondition/OrganizerTableWithAction';
import { SendOrganizerTicketEmailOption } from '@/components/event/create/inviteCondition/SendOrganizerTicketEmailOption';
import { Slider } from '@/components/ui/slider';
import { VirtualizedCombobox } from '@/components/ui/virtualized-combobox';
import { useCreateEventOrganizersState } from '@/hooks/organizers/useEventOrganizersState';
import { useOrganizerPickerOptions } from '@/hooks/organizers/useOrganizerPickerOptions';
import {
  calculateMaxTicketsPerOrganizer,
  useOrganizerTickets,
} from '@/hooks/organizers/useOrganizerTickets';
import { sumInvitationTicketAmounts } from '@/lib/chief-organizer-event';
import {
  getTotalTicketsWithoutOrganizer,
  type EventOrganizersState,
} from '@/lib/event-organizers';
import { roleTranslation } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { type OrganizerSchema } from '@/server/schemas/organizer';
import { trpc } from '@/server/trpc/client';
import { type InviteCondition } from '@/server/types';

function OrganizerCapacitySummary({
  organizers,
  maxCapacity,
  usesTicketPool = false,
}: {
  organizers: OrganizerSchema[];
  maxCapacity?: number;
  usesTicketPool?: boolean;
}) {
  const assignedTickets = useMemo(
    () =>
      organizers.reduce((sum, org) => {
        if ('ticketAmount' in org && org.ticketAmount !== null) {
          return sum + org.ticketAmount;
        }
        return sum;
      }, 0),
    [organizers],
  );

  const totalAssignable = maxCapacity ?? 0;
  const remainingTickets = Math.max(
    0,
    usesTicketPool
      ? totalAssignable - assignedTickets
      : totalAssignable - organizers.length - assignedTickets,
  );

  if (maxCapacity === undefined) {
    return (
      <div className='shrink-0 text-left text-sm text-muted-foreground sm:text-right'>
        <p>
          {usesTicketPool
            ? 'No tenés tickets asignados para distribuir'
            : 'Seleccioná una locación para ver la capacidad'}
        </p>
      </div>
    );
  }

  return (
    <div className='shrink-0 text-left text-sm pb-1 leading-tight sm:text-right'>
      <p className='tabular-nums'>
        <span className='text-muted-foreground'>Tickets asignados: </span>
        <span className='font-semibold text-accent-dark text-base'>
          {assignedTickets}/{totalAssignable}
        </span>
      </p>
      <p className='tabular-nums'>
        <span className='text-muted-foreground'>Tickets restantes: </span>
        <span className='font-semibold text-accent-dark text-base'>
          {remainingTickets}
        </span>
      </p>
    </div>
  );
}

export function EventOrganizers({ type }: { type: InviteCondition }) {
  const state = useCreateEventOrganizersState();
  return <EventOrganizersContent type={type} {...state} />;
}

export function EventOrganizersContent({
  type,
  showSendEmailOption = true,
  capacityOrganizers,
  organizers,
  addOrganizer,
  deleteOrganizer,
  updateOrganizerNumber,
  updateAllOrganizerNumber,
  sendOrganizerTicketEmail,
  setSendOrganizerTicketEmail,
  locationId,
  ticketTypes,
  eventId,
  ticketPool,
  nonDeletableOrganizerIds,
}: {
  type: InviteCondition;
  showSendEmailOption?: boolean;
  capacityOrganizers?: OrganizerSchema[];
  ticketPool?: number;
  nonDeletableOrganizerIds?: string[];
} & EventOrganizersState) {
  const organizersForCapacity = capacityOrganizers ?? organizers;
  const usesTicketPool = ticketPool !== undefined;

  const {
    maxNumber,
    maxCapacity,
    minNumber,
    usesTicketPool: poolMode,
  } = useOrganizerTickets(type, {
    organizers: organizersForCapacity,
    locationId,
    ticketPool,
  });
  const [defaultNumber, setDefaultNumber] = useState<number>(minNumber);
  const [selectedComboboxOption, setSelectedComboboxOption] =
    useState<string>('');
  const { data: organizersData } = useOrganizerPickerOptions();

  const { data: location } = trpc.location.getById.useQuery(locationId ?? '', {
    enabled: !!locationId && type === 'TRADITIONAL',
  });

  const prevMaxNumberRef = useRef(maxNumber);
  const prevDefaultNumberRef = useRef(defaultNumber);
  const prevOrganizersLengthRef = useRef(organizers.length);

  // Cambios para el máximo de tickets por organizador
  useEffect(() => {
    const maxChanged = prevMaxNumberRef.current !== maxNumber;
    const defaultChanged = prevDefaultNumberRef.current !== defaultNumber;
    const organizersLengthChanged =
      prevOrganizersLengthRef.current !== organizers.length;

    // Si nada cambió, no hacer nada
    if (!maxChanged && !defaultChanged && !organizersLengthChanged) {
      return;
    }

    let clampedDefault = defaultNumber;

    if (maxNumber !== 0) {
      // Si el maxNumber cambió (especialmente cuando aumenta por eliminar un organizador)
      if (maxChanged) {
        const prevMax = prevMaxNumberRef.current;
        // Solo actualizar el defaultNumber si:
        // 1. Era igual al maxNumber anterior (para mantener el comportamiento de "máximo")
        // 2. O excede el nuevo maxNumber (necesita ser ajustado hacia abajo)
        if (defaultNumber > maxNumber) {
          // Si excede el nuevo máximo, ajustar hacia abajo
          clampedDefault = maxNumber;
        } else if (
          prevMax !== 0 &&
          prevMax > maxNumber && // Si agrego un organizador
          (defaultNumber === prevMax || Math.abs(defaultNumber - prevMax) <= 1)
        ) {
          // Si era igual al anterior, actualizar al nuevo máximo
          clampedDefault = Math.min(defaultNumber, maxNumber);
        }
        // Si defaultNumber < maxNumber y no era igual al anterior, NO cambiar (mantener el valor)
      } else {
        // Si el maxNumber no cambió, solo ajustar si excede el máximo
        if (defaultNumber > maxNumber) {
          clampedDefault = maxNumber;
        }
      }
    }

    // Actualizar el default si cambió
    if (defaultNumber !== clampedDefault) {
      setDefaultNumber(clampedDefault);
    }

    // Para el modo INVITACIÓN, asegurar que todos los organizadores respeten los nuevos límites
    if (
      type === 'INVITATION' &&
      !usesTicketPool &&
      (maxChanged || organizersLengthChanged)
    ) {
      // Verificar si algún organizador excede el nuevo máximo
      organizers.forEach((org) => {
        const currentAmount = 'ticketAmount' in org ? org.ticketAmount : null;
        if (
          currentAmount !== null &&
          currentAmount > maxNumber &&
          maxNumber !== 0
        ) {
          updateOrganizerNumber(org, maxNumber, type);
        }
      });
    }

    prevMaxNumberRef.current = maxNumber;
    prevDefaultNumberRef.current = defaultNumber;
    prevOrganizersLengthRef.current = organizers.length;
  }, [
    maxNumber,
    type,
    defaultNumber,
    organizers,
    updateOrganizerNumber,
    updateAllOrganizerNumber,
    usesTicketPool,
  ]);

  const selectedOrganizers = useMemo(
    () =>
      organizers.map((org) => ({
        id: org.id,
        fullName: org.fullName,
        dni: org.dni,
        phoneNumber: org.phoneNumber,
        number:
          'discountPercentage' in org &&
          type === 'TRADITIONAL' &&
          org.discountPercentage !== null
            ? org.discountPercentage
            : 'ticketAmount' in org &&
                type === 'INVITATION' &&
                org.ticketAmount !== null
              ? org.ticketAmount
              : 0,
        role: org.role,
      })),
    [organizers, type],
  );

  const organizerOptions = useMemo(() => {
    if (!organizersData) return [];

    const selectableOrganizers = organizersData.filter(
      (organizer) =>
        organizer.role === 'ORGANIZER' &&
        !selectedOrganizers?.some((org) => org.id === organizer.id),
    );

    return selectableOrganizers.map((organizer) => ({
      value: `${organizer.id}`,
      label: `${organizer.fullName} - ${organizer.dni}`,
    }));
  }, [organizersData, selectedOrganizers]);

  const groupedOptions = useMemo(() => {
    if (!organizersData) return undefined;

    const selectableOrganizers = organizersData.filter(
      (organizer) =>
        !selectedOrganizers?.some((org) => org.id === organizer.id),
    );

    const chiefOrganizers = selectableOrganizers.filter(
      (org) => org.role === 'CHIEF_ORGANIZER',
    );
    const regularOrganizers = selectableOrganizers.filter(
      (org) => org.role === 'ORGANIZER',
    );

    // Agrupar organizadores por sus tags
    const tagGroups = new Map<
      string,
      { name: string; organizers: typeof regularOrganizers }
    >();

    regularOrganizers.forEach((organizer) => {
      organizer.userXTags?.forEach((userXTag) => {
        const tag = userXTag.tag;
        if (!tagGroups.has(tag.id)) {
          tagGroups.set(tag.id, { name: tag.name, organizers: [] });
        }
        tagGroups.get(tag.id)!.organizers.push(organizer);
      });
    });

    // Convertir a opciones agrupadas para el combobox
    const tagOptions = Array.from(tagGroups.entries()).map(
      ([tagId, tagData]) => ({
        value: `tag:${tagId}`,
        label: `🏷️ ${tagData.name} (${tagData.organizers.length} organizador${tagData.organizers.length > 1 ? 'es' : ''})`,
        tagData,
      }),
    );

    // Agrupar CHIEF_ORGANIZER
    const chiefGroups = new Map<
      string,
      { name: string; organizers: typeof chiefOrganizers }
    >();

    chiefOrganizers.forEach((organizer) => {
      const key = organizer.id;
      if (!chiefGroups.has(key)) {
        chiefGroups.set(key, {
          name: organizer.fullName,
          organizers: [],
        });
      }
      chiefGroups.get(key)!.organizers.push(organizer);
    });

    // Convertir chiefs a opciones agrupadas
    const chiefOptions = Array.from(chiefGroups.entries()).map(
      ([chiefId, chiefData]) => {
        // Contar organizadores relacionados con este CHIEF_ORGANIZER
        const relatedCount = organizersData.filter(
          (org) =>
            org.role === 'ORGANIZER' &&
            org.chiefOrganizerId === chiefId &&
            !selectedOrganizers?.some((selected) => selected.id === org.id),
        ).length;

        return {
          value: `chief:${chiefId}`,
          label: `👤 ${chiefData.name} - ${chiefData.organizers[0]?.dni}${relatedCount > 0 ? ` (${relatedCount} organizador${relatedCount > 1 ? 'es' : ''})` : ''}`,
          chiefData,
        };
      },
    );

    const groups = [];

    // Grupo 1: Tags (arriba)
    if (tagOptions.length > 0) {
      groups.push({
        group: 'Tags',
        options: tagOptions,
      });
    }

    // Grupo 2: Jefes de Organizadores (debajo de tags, arriba de organizadores)
    if (chiefOptions.length > 0) {
      groups.push({
        group: roleTranslation['CHIEF_ORGANIZER'],
        options: chiefOptions,
      });
    }

    return groups.length > 0 ? groups : undefined;
  }, [organizersData, selectedOrganizers]);

  // Limpiar la selección del combobox cuando se eliminan organizadores
  useEffect(() => {
    if (!selectedComboboxOption) return;

    const dni = selectedComboboxOption.split(' - ').pop();
    const id = organizersData?.find((org) => org.dni === dni)?.id;
    if (!id) return;

    const isStillSelected = organizers.some((org) => org.id === id);
    if (!isStillSelected) {
      setSelectedComboboxOption('');
    }
  }, [organizers, organizersData, selectedComboboxOption]);

  // Calcular el total de tickets sin el ticket type de organizador
  const totalTicketsWithoutOrganizer = useMemo(
    () => getTotalTicketsWithoutOrganizer(ticketTypes),
    [ticketTypes],
  );

  // Función para verificar si hay capacidad disponible
  const checkCapacity = useCallback(
    (organizersToAdd: number): boolean => {
      if (type !== 'TRADITIONAL' || !location) return true;

      const totalOrganizersAfter = organizers.length + organizersToAdd;

      const totalTicketsAfter =
        totalTicketsWithoutOrganizer + totalOrganizersAfter;

      const availableCapacity = location.capacity - totalTicketsAfter;

      return availableCapacity >= 0;
    },
    [type, location, organizers.length, totalTicketsWithoutOrganizer],
  );

  const getInvitationMaxAllowed = useCallback(
    (organizersToAdd: number) => {
      if (ticketPool !== undefined) {
        const assigned = sumInvitationTicketAmounts(organizersForCapacity);
        const remaining = ticketPool - assigned;
        if (organizersToAdd <= 0) return Math.max(0, remaining);
        return Math.max(0, Math.floor(remaining / organizersToAdd));
      }

      if (!maxCapacity) return maxNumber;

      return calculateMaxTicketsPerOrganizer(
        maxCapacity,
        organizersForCapacity.length + organizersToAdd,
      );
    },
    [ticketPool, organizersForCapacity, maxCapacity, maxNumber],
  );

  return (
    <div className='min-w-0'>
      <div
        className={cn(
          'flex flex-col gap-4',
          type === 'INVITATION' && 'sm:flex-row sm:items-start sm:gap-6',
        )}
      >
        <div className='min-w-0 flex-1'>
          <VirtualizedCombobox
            searchPlaceholder='Agregar organizador...'
            onSelectOption={(option) => {
              if (option.startsWith('tag:')) {
                const tagId = option.replace('tag:', '');
                if (!groupedOptions) return;

                // Buscar en el grupo de Tags
                const tagsGroup = groupedOptions.find(
                  (g) => g.group === 'Tags',
                );
                const tagOption = tagsGroup?.options.find(
                  (
                    opt,
                  ): opt is {
                    value: string;
                    label: string;
                    tagData: {
                      name: string;
                      organizers: NonNullable<typeof organizersData>;
                    };
                  } => opt.value === `tag:${tagId}` && 'tagData' in opt,
                );

                if (tagOption && 'tagData' in tagOption) {
                  const organizersToAdd = tagOption.tagData.organizers;
                  const totalToAdd = organizersToAdd.length;

                  if (type === 'TRADITIONAL' && !checkCapacity(totalToAdd)) {
                    toast.error(
                      'Se alcanzó la capacidad máxima en la locación',
                    );
                    return;
                  }

                  // Calcular el máximo permitido una vez, considerando todos los organizadores que se agregarán
                  const maxAllowed =
                    type === 'INVITATION'
                      ? getInvitationMaxAllowed(totalToAdd)
                      : undefined;

                  organizersToAdd.forEach((organizer) => {
                    if (type === 'TRADITIONAL') {
                      addOrganizer(organizer, defaultNumber, type);
                    } else {
                      const clampedNumber = maxAllowed
                        ? Math.min(defaultNumber, maxAllowed)
                        : defaultNumber;
                      addOrganizer(organizer, clampedNumber, type);
                    }
                  });
                }
              } else if (option.startsWith('chief:')) {
                const chiefId = option.replace('chief:', '');
                if (!groupedOptions || !organizersData) return;

                // Buscar en el grupo de Jefes de Organizadores
                const chiefsGroup = groupedOptions.find(
                  (g) => g.group === roleTranslation['CHIEF_ORGANIZER'],
                );
                const chiefOption = chiefsGroup?.options.find(
                  (
                    opt,
                  ): opt is {
                    value: string;
                    label: string;
                    chiefData: {
                      name: string;
                      organizers: NonNullable<typeof organizersData>;
                    };
                  } => opt.value === `chief:${chiefId}` && 'chiefData' in opt,
                );

                if (chiefOption && 'chiefData' in chiefOption) {
                  const chiefOrganizer = chiefOption.chiefData.organizers[0];
                  if (!chiefOrganizer) return;

                  // Buscar todos los ORGANIZER relacionados con este CHIEF_ORGANIZER
                  const relatedOrganizers = organizersData.filter(
                    (org) =>
                      org.role === 'ORGANIZER' &&
                      org.chiefOrganizerId === chiefOrganizer.id &&
                      !organizers.some((o) => o.id === org.id),
                  );

                  // Calcular total de organizadores a agregar (CHIEF + sus relacionados)
                  const totalToAdd = 1 + relatedOrganizers.length;

                  // Verificar capacidad en modo TRADITIONAL
                  if (type === 'TRADITIONAL' && !checkCapacity(totalToAdd)) {
                    toast.error(
                      'Se alcanzó la capacidad máxima en la locación',
                    );
                    return;
                  }

                  // Calcular el máximo permitido una vez, considerando todos los organizadores que se agregarán
                  const maxAllowed =
                    type === 'INVITATION'
                      ? getInvitationMaxAllowed(totalToAdd)
                      : undefined;

                  // Agregar el CHIEF_ORGANIZER
                  if (type === 'TRADITIONAL') {
                    addOrganizer(chiefOrganizer, defaultNumber, type);
                  } else {
                    const clampedNumber = maxAllowed
                      ? Math.min(defaultNumber, maxAllowed)
                      : defaultNumber;
                    addOrganizer(chiefOrganizer, clampedNumber, type);
                  }

                  // Agregar todos los ORGANIZER relacionados
                  relatedOrganizers.forEach((relatedOrg) => {
                    if (type === 'TRADITIONAL') {
                      addOrganizer(relatedOrg, defaultNumber, type);
                    } else {
                      const clampedNumber = maxAllowed
                        ? Math.min(defaultNumber, maxAllowed)
                        : defaultNumber;
                      addOrganizer(relatedOrg, clampedNumber, type);
                    }
                  });
                }
              } else {
                // El option es el ID del organizador (value del objeto)
                const organizerId = option;
                const organizer = organizersData?.find(
                  (org) => org.id === organizerId,
                );
                if (!organizer) return;

                if (type === 'TRADITIONAL' && !checkCapacity(1)) {
                  toast.error('Se alcanzó la capacidad máxima en la locación');
                  return;
                }

                if (type === 'TRADITIONAL') {
                  addOrganizer(organizer, defaultNumber, type);
                } else {
                  const maxAllowed =
                    type === 'INVITATION'
                      ? getInvitationMaxAllowed(1)
                      : maxNumber;
                  const clampedNumber = Math.min(defaultNumber, maxAllowed);
                  addOrganizer(organizer, clampedNumber, type);
                }
              }
            }}
            showSelectedOptions={false}
            options={organizerOptions || []}
            groupedOptions={groupedOptions}
            selectedOption={selectedComboboxOption}
            onSelectedOptionChange={setSelectedComboboxOption}
          />
        </div>
        {type === 'INVITATION' && (
          <OrganizerCapacitySummary
            organizers={organizersForCapacity}
            maxCapacity={maxCapacity}
            usesTicketPool={usesTicketPool || poolMode}
          />
        )}
      </div>

      <OrganizerTableWithAction
        type={type}
        data={selectedOrganizers || []}
        usesTicketPool={usesTicketPool || poolMode}
        nonDeletableOrganizerIds={nonDeletableOrganizerIds}
        capacityData={
          capacityOrganizers
            ? capacityOrganizers.map((org) => ({
                id: org.id,
                fullName: org.fullName,
                dni: org.dni,
                phoneNumber: org.phoneNumber,
                role: org.role,
                number:
                  'ticketAmount' in org && org.ticketAmount !== null
                    ? org.ticketAmount
                    : 'discountPercentage' in org &&
                        org.discountPercentage !== null
                      ? org.discountPercentage
                      : 0,
              }))
            : undefined
        }
        numberTitle={
          type === 'TRADITIONAL'
            ? 'Porcentaje de descuento'
            : 'Cantidad de tickets'
        }
        maxNumber={maxNumber}
        maxCapacity={maxCapacity}
        eventId={eventId}
        updateOrganizerNumber={updateOrganizerNumber}
        deleteOrganizer={deleteOrganizer}
      >
        <div className='w-full sm:max-w-1/3 justify-self-end mt-4'>
          <p className='text-sm text-muted-foreground'>
            {type === 'TRADITIONAL'
              ? 'Porcentaje de descuento por defecto'
              : 'Cantidad de tickets por defecto'}
          </p>
          <div className='rounded-t-md bg-accent-ultra-light border-stroke border border-b-0 flex gap-2 px-4 py-2'>
            <p className={cn('tabular-nums', type === 'INVITATION' && 'pr-2')}>
              {defaultNumber ?? 0}
              {type === 'TRADITIONAL' && '%'}
            </p>
            <Slider
              value={[defaultNumber]}
              max={maxNumber}
              min={minNumber}
              step={1}
              onValueChange={(value) => {
                const clampedValue = Math.min(value[0], maxNumber);
                setDefaultNumber(clampedValue);
                updateAllOrganizerNumber(clampedValue, type);
              }}
              className='w-full'
            />
          </div>
        </div>
      </OrganizerTableWithAction>
      {showSendEmailOption && organizers.length > 0 && (
        <SendOrganizerTicketEmailOption
          checked={sendOrganizerTicketEmail}
          onCheckedChange={setSendOrganizerTicketEmail}
          className='rounded-md border border-stroke bg-accent-ultra-light px-4 py-3'
        />
      )}
    </div>
  );
}
