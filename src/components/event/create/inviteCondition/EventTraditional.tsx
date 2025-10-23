import React, { useMemo, useState } from 'react';

import { useCreateEventStore } from '@/app/admin/event/create/provider';
import { VirtualizedCombobox } from '@/components/ui/virtualized-combobox';
import { trpc } from '@/server/trpc/client';
import { OrganizerTableWithAction } from '@/components/event/create/inviteCondition/OrganizerTableWithAction';
import { Slider } from '@/components/ui/slider';

export function EventTraditional() {
  const [defaultPercentage, setDefaultPercentage] = useState<number>(0);
  const [selectedComboboxOption, setSelectedComboboxOption] =
    useState<string>('');
  const { data: organizersData } = trpc.user.getOrganizers.useQuery();
  const addOrganizer = useCreateEventStore((state) => state.addOrganizer);
  const organizers = useCreateEventStore((state) => state.organizers);
  const updateOrganizerNumber = useCreateEventStore(
    (state) => state.updateAllOrganizerNumber,
  );

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
          addOrganizer(dni!, defaultPercentage, 'TRADITIONAL');
        }}
        showSelectedOptions={false}
        options={organizerOptions || []}
        selectedOption={selectedComboboxOption}
        onSelectedOptionChange={setSelectedComboboxOption}
      />
      <OrganizerTableWithAction
        type='TRADITIONAL'
        data={selectedOrganizers || []}
        numberTitle='Porcentaje de descuento'
      >
        <div className='w-full max-w-1/3'>
          <p>Porcentaje por defecto</p>
          <div className='rounded-t-md bg-accent-ultra-light border-stroke border border-b-0 flex gap-2 px-4 py-2'>
            <p className='tabular-nums'>{defaultPercentage ?? 0}%</p>
            <Slider
              defaultValue={[defaultPercentage ?? 0]}
              max={100}
              min={0}
              step={1}
              onValueChange={(value) => {
                setDefaultPercentage(value[0]);
                updateOrganizerNumber(value[0], 'TRADITIONAL');
              }}
              className='w-full'
            />
          </div>
        </div>
      </OrganizerTableWithAction>
    </div>
  );
}
