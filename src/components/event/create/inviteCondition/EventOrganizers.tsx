import React, { useMemo, useState } from 'react';

import { useCreateEventStore } from '@/app/admin/event/create/provider';
import { VirtualizedCombobox } from '@/components/ui/virtualized-combobox';
import { trpc } from '@/server/trpc/client';
import { OrganizerTableWithAction } from '@/components/event/create/inviteCondition/OrganizerTableWithAction';
import { Slider } from '@/components/ui/slider';
import { type InviteCondition } from '@/server/types';
import {
  calculateMaxTicketsPerOrganizer,
  useOrganizerTickets,
} from '@/hooks/useOrganizerTickets';
import { cn } from '@/lib/utils';

export function EventOrganizers({ type }: { type: InviteCondition }) {
  const { maxNumber, maxCapacity } = useOrganizerTickets(type);
  const [defaultNumber, setDefaultNumber] = useState<number>(0);
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

  // Ensure default number doesn't exceed max
  React.useEffect(() => {
    if (defaultNumber > maxNumber) {
      setDefaultNumber(maxNumber);
    }
  }, [maxNumber, defaultNumber]);

  // For INVITATION mode, clamp existing organizers when max changes
  React.useEffect(() => {
    if (type === 'INVITATION') {
      organizers.forEach((org) => {
        const currentAmount = 'ticketAmount' in org ? org.ticketAmount : 0;
        if (currentAmount > maxNumber) {
          updateOrganizerNumber(org.dni, maxNumber, type);
        }
      });
    }
  }, [maxNumber, type, organizers, updateOrganizerNumber]);

  const selectedOrganizers = useMemo(() => {
    return organizersData
      ?.filter((organizer) =>
        organizers.find((org) => org.dni === organizer.dni),
      )
      .map((organizer) => {
        const org = organizers.find((org) => org.dni === organizer.dni);
        return {
          id: organizer.dni,
          fullName: organizer.fullName,
          dni: organizer.dni,
          phoneNumber: organizer.phoneNumber,
          number:
            org && 'discountPercentage' in org
              ? org.discountPercentage
              : org && 'ticketAmount' in org
                ? org.ticketAmount
                : 0,
        };
      });
  }, [organizersData, organizers]);

  const organizerOptions = useMemo(() => {
    return organizersData
      ?.filter(
        (organizer) =>
          !selectedOrganizers?.some((org) => org.dni === organizer.dni),
      )
      .map((organizer) => `${organizer.fullName} - ${organizer.dni}`);
  }, [organizersData, selectedOrganizers]);

  // Clear combobox selection when organizers are deleted
  React.useEffect(() => {
    if (selectedComboboxOption) {
      const dni = selectedComboboxOption.split(' - ').pop();
      const isStillSelected = organizers.some((org) => org.dni === dni);
      if (!isStillSelected) {
        setSelectedComboboxOption('');
      }
    }
  }, [organizers, selectedComboboxOption]);

  return (
    <div>
      <VirtualizedCombobox
        searchPlaceholder='Agregar organizador...'
        onSelectOption={(option) => {
          const dni = option.split(' - ').pop();
          if (!dni) return;
          if (type === 'TRADITIONAL') {
            addOrganizer(dni, defaultNumber, type);
          } else {
            // For INVITATION mode, use the default number but clamp it to the maximum allowed
            const maxAllowed = maxCapacity
              ? calculateMaxTicketsPerOrganizer(
                  maxCapacity,
                  organizers.length + 1,
                )
              : maxNumber;
            const clampedNumber = Math.min(defaultNumber, maxAllowed);
            addOrganizer(dni, clampedNumber, type);
          }
        }}
        showSelectedOptions={false}
        options={organizerOptions || []}
        selectedOption={selectedComboboxOption}
        onSelectedOptionChange={setSelectedComboboxOption}
      />
      <OrganizerTableWithAction
        type={type}
        data={selectedOrganizers || []}
        numberTitle={
          type === 'TRADITIONAL'
            ? 'Porcentaje de descuento'
            : 'Cantidad de tickets'
        }
        maxNumber={maxNumber}
      >
        <div className='w-full max-w-1/3'>
          <p>
            {type === 'TRADITIONAL'
              ? 'Porcentaje por defecto'
              : 'Cantidad por defecto'}
          </p>
          <div className='rounded-t-md bg-accent-ultra-light border-stroke border border-b-0 flex gap-2 px-4 py-2'>
            <p className={cn('tabular-nums', type === 'INVITATION' && 'pr-2')}>
              {defaultNumber ?? 0}
              {type === 'TRADITIONAL' && '%'}
            </p>
            <Slider
              defaultValue={[defaultNumber ?? 0]}
              max={maxNumber}
              min={0}
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
