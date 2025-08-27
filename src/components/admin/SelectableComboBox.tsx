'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { type ComparativeStatWithType } from '@/components/admin/ComparativeTable';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function SelectableComboBox({
  list,
  onSelect,
  title,
  listOf,
}: {
  list: ComparativeStatWithType[];
  onSelect: (item: ComparativeStatWithType) => void;
  title: string;
  listOf: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button role='combobox' aria-expanded={open}>
          {title}
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='p-0 w-fit'>
        <Command>
          <CommandInput placeholder={`Buscar ${listOf}...`} />
          <CommandList>
            <CommandEmpty>No se encontro {listOf}</CommandEmpty>
            <CommandGroup>
              {list.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? '' : currentValue);
                    setOpen(false);
                    onSelect(item);
                  }}
                >
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
