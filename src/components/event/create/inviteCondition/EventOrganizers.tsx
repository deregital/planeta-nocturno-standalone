import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { OrganizerTableWithAction } from '@/components/event/create/inviteCondition/OrganizerTableWithAction';
import { Slider } from '@/components/ui/slider';
import { VirtualizedCombobox } from '@/components/ui/virtualized-combobox';
import {
  calculateMaxTicketsPerOrganizer,
  useOrganizerTickets,
} from '@/hooks/useOrganizerTickets';
import { roleTranslation } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { trpc } from '@/server/trpc/client';
import { type InviteCondition } from '@/server/types';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';

export function EventOrganizers({ type }: { type: InviteCondition }) {
  const { maxNumber, maxCapacity, minNumber } = useOrganizerTickets(type);
  const [defaultNumber, setDefaultNumber] = useState<number>(minNumber);
  const [selectedComboboxOption, setSelectedComboboxOption] =
    useState<string>('');
  const { data: organizersData } = trpc.user.getOrganizers.useQuery();
  const addOrganizer = useCreateEventStore((state) => state.addOrganizer);
  const organizers = useCreateEventStore((state) => state.organizers);
  const ticketTypes = useCreateEventStore((state) => state.ticketTypes);
  const event = useCreateEventStore((state) => state.event);
  const updateAllOrganizerNumber = useCreateEventStore(
    (state) => state.updateAllOrganizerNumber,
  );
  const updateOrganizerNumber = useCreateEventStore(
    (state) => state.updateOrganizerNumber,
  );

  const { data: location } = trpc.location.getById.useQuery(event.locationId, {
    enabled: !!event.locationId && type === 'TRADITIONAL',
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
    if (type === 'INVITATION' && (maxChanged || organizersLengthChanged)) {
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
  ]);

  const selectedOrganizers = useMemo(() => {
    return organizersData
      ?.filter((organizer) => organizers.find((org) => org.id === organizer.id))
      .map((organizer) => {
        const org = organizers.find((org) => org.id === organizer.id);
        return {
          id: organizer.id,
          fullName: organizer.fullName,
          dni: organizer.dni,
          phoneNumber: organizer.phoneNumber,
          number:
            org &&
            'discountPercentage' in org &&
            type === 'TRADITIONAL' &&
            org.discountPercentage !== null
              ? org.discountPercentage
              : org &&
                  'ticketAmount' in org &&
                  type === 'INVITATION' &&
                  org.ticketAmount !== null
                ? org.ticketAmount
                : 0,
          role: organizer.role,
        };
      });
  }, [organizersData, organizers]);

  const organizerOptions = useMemo(() => {
    if (!organizersData) return [];

    const selectableOrganizers = organizersData.filter(
      (organizer) =>
        organizer.role === 'ORGANIZER' &&
        !selectedOrganizers?.some((org) => org.id === organizer.id),
    );

    return selectableOrganizers.map(
      (organizer) => `${organizer.fullName} - ${organizer.dni}`,
    );
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
    if (selectedComboboxOption) {
      const dni = selectedComboboxOption.split(' - ').pop();
      const id = organizersData?.find((org) => org.dni === dni)?.id;
      const isStillSelected = organizers.some((org) => org.id === id);
      if (!isStillSelected) {
        setSelectedComboboxOption('');
      }
    }
  }, [organizers, organizersData, selectedComboboxOption]);

  // Calcular el total de tickets sin el ticket type de organizador
  const totalTicketsWithoutOrganizer = useMemo(() => {
    return ticketTypes
      .filter((t) => t.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim())
      .reduce((acc, t) => acc + t.maxAvailable, 0);
  }, [ticketTypes]);

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

  return (
    <div>
      <div>
        <VirtualizedCombobox
          searchPlaceholder='Agregar organizador...'
          onSelectOption={(option) => {
            if (option.startsWith('tag:')) {
              const tagId = option.replace('tag:', '');
              if (!groupedOptions) return;

              // Buscar en el grupo de Tags
              const tagsGroup = groupedOptions.find((g) => g.group === 'Tags');
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
                  toast.error('Se alcanzó la capacidad máxima en la locación');
                  return;
                }

                // Calcular el máximo permitido una vez, considerando todos los organizadores que se agregarán
                const maxAllowed =
                  type === 'INVITATION'
                    ? maxCapacity
                      ? calculateMaxTicketsPerOrganizer(
                          maxCapacity,
                          organizers.length + totalToAdd,
                        )
                      : maxNumber
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
                  toast.error('Se alcanzó la capacidad máxima en la locación');
                  return;
                }

                // Calcular el máximo permitido una vez, considerando todos los organizadores que se agregarán
                const maxAllowed =
                  type === 'INVITATION'
                    ? maxCapacity
                      ? calculateMaxTicketsPerOrganizer(
                          maxCapacity,
                          organizers.length + totalToAdd,
                        )
                      : maxNumber
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
              const dni = option.split(' - ').pop();
              if (!dni) return;
              const id = organizersData?.find((org) => org.dni === dni)?.id;
              const organizer = organizersData?.find((org) => org.id === id);
              if (!organizer) return;

              if (type === 'TRADITIONAL' && !checkCapacity(1)) {
                toast.error('Se alcanzó la capacidad máxima en la locación');
                return;
              }

              if (type === 'TRADITIONAL') {
                addOrganizer(organizer, defaultNumber, type);
              } else {
                const maxAllowed = maxCapacity
                  ? calculateMaxTicketsPerOrganizer(
                      maxCapacity,
                      organizers.length + 1,
                    )
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

      <OrganizerTableWithAction
        type={type}
        data={selectedOrganizers || []}
        numberTitle={
          type === 'TRADITIONAL'
            ? 'Porcentaje de descuento'
            : 'Cantidad de tickets'
        }
        maxNumber={maxNumber}
        maxCapacity={maxCapacity}
      >
        <div className='w-full max-w-1/3'>
          <p>
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
    </div>
  );
}
