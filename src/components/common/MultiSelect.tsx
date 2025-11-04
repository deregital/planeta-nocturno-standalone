'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  label?: string;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selectedValues,
  onSelectionChange,
  label,
  placeholder = 'Selecciona opciones',
  emptyMessage = 'No hay opciones disponibles',
  className,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (value: string) => {
    const isSelected = selectedValues.includes(value);
    onSelectionChange(
      isSelected
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value],
    );
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    }
    if (selectedValues.length === 1) {
      const selectedOption = options.find(
        (opt) => opt.value === selectedValues[0],
      );
      return selectedOption?.label || selectedValues[0];
    }
    return `${selectedValues.length} seleccionados`;
  };

  return (
    <div className={cn('flex flex-col', className)}>
      {label && <p className='text-sm text-accent'>{label}</p>}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            role='combobox'
            className='w-full justify-between border-stroke border rounded-md'
          >
            {getDisplayText()}
            <ChevronDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className='w-(--radix-popover-trigger-width) p-0'
          align='start'
        >
          <div className='max-h-[300px] overflow-y-auto p-2'>
            <div className='space-y-2'>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className='flex items-center space-x-2 rounded-sm px-2 py-1.5 hover:bg-accent-ultra-light cursor-pointer'
                    onClick={() => handleToggle(option.value)}
                  >
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-sm border border-stroke',
                        isSelected
                          ? 'bg-accent text-on-accent'
                          : 'bg-transparent',
                      )}
                    >
                      {isSelected && <Check className='h-3 w-3' />}
                    </div>
                    <span className='text-sm'>{option.label}</span>
                  </div>
                );
              })}
            </div>
            {options.length === 0 && (
              <p className='text-sm text-muted-foreground py-2 text-center'>
                {emptyMessage}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
