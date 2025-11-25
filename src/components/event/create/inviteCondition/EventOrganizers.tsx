import { useEffect, useMemo, useRef, useState } from 'react';

import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { OrganizerTableWithAction } from '@/components/event/create/inviteCondition/OrganizerTableWithAction';
import { Slider } from '@/components/ui/slider';
import { VirtualizedCombobox } from '@/components/ui/virtualized-combobox';
import {
  calculateMaxTicketsPerOrganizer,
  useOrganizerTickets,
} from '@/hooks/useOrganizerTickets';
import { cn } from '@/lib/utils';
import { trpc } from '@/server/trpc/client';
import { type InviteCondition } from '@/server/types';

export function EventOrganizers({ type }: { type: InviteCondition }) {
  const { maxNumber, maxCapacity, minNumber } = useOrganizerTickets(type);
  const [defaultNumber, setDefaultNumber] = useState<number>(minNumber);
  const [selectedComboboxOption, setSelectedComboboxOption] =
    useState<string>('');
  const { data: organizersData } = trpc.user.getOrganizers.useQuery();
  const addOrganizer = useCreateEventStore((state) => state.addOrganizer);
  const organizers = useCreateEventStore((state) => state.organizers);
  const updateAllOrganizerNumber = useCreateEventStore(
    (state) => state.updateAllOrganizerNumber,
  );
  const updateOrganizerNumber = useCreateEventStore(
    (state) => state.updateOrganizerNumber,
  );

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
        };
      });
  }, [organizersData, organizers]);

  const organizerOptions = useMemo(() => {
    return organizersData
      ?.filter(
        (organizer) =>
          !selectedOrganizers?.some((org) => org.id === organizer.id),
      )
      .map((organizer) => `${organizer.fullName} - ${organizer.dni}`);
  }, [organizersData, selectedOrganizers]);

  const groupedOptions = useMemo(() => {
    if (!organizersData) return undefined;

    const selectableOrganizers = organizersData.filter(
      (organizer) =>
        !selectedOrganizers?.some((org) => org.id === organizer.id),
    );

    // Agrupar organizadores por sus tags
    const tagGroups = new Map<
      string,
      { name: string; organizers: typeof selectableOrganizers }
    >();

    selectableOrganizers.forEach((organizer) => {
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

    return [
      {
        group: 'Tags',
        options: tagOptions,
      },
    ];
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

  return (
    <div>
      <div>
        <VirtualizedCombobox
          searchPlaceholder='Agregar organizador...'
          onSelectOption={(option) => {
            if (option.startsWith('tag:')) {
              const tagId = option.replace('tag:', '');
              const tagOption = groupedOptions?.[0]?.options.find(
                (opt) => opt.value === `tag:${tagId}`,
              );
              if (tagOption && 'tagData' in tagOption) {
                tagOption.tagData.organizers.forEach((organizer) => {
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
                });
              }
            } else {
              const dni = option.split(' - ').pop();
              if (!dni) return;
              const id = organizersData?.find((org) => org.dni === dni)?.id;
              const organizer = organizersData?.find((org) => org.id === id);
              if (!organizer) return;
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
