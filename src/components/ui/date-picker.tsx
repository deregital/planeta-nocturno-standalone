'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { es } from 'date-fns/locale';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

function formatDate(date: Date | undefined) {
  if (!date) {
    return '';
  }

  return (
    format(date, 'PPPP', { locale: es }).charAt(0).toUpperCase() +
    format(date, 'PPPP', { locale: es }).slice(1)
  );
}

type DatePickerProps = Omit<
  React.ComponentProps<typeof Calendar>,
  'mode' | 'selected' | 'onSelect'
> & {
  onSelectAction: (date: Date) => void;
  placeholder?: string;
  selected: Date;
  disabled?: boolean;
};

export function DatePicker({ onSelectAction, ...inputProps }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(inputProps.selected);
  const [value, setValue] = useState(formatDate(inputProps.selected));

  useEffect(() => {
    setMonth(inputProps.selected);
    setValue(formatDate(inputProps.selected));
  }, [inputProps.selected]);

  return (
    <div className='relative flex gap-2'>
      <Input
        id='text'
        value={value}
        readOnly
        disabled={inputProps.disabled}
        placeholder={inputProps.placeholder}
        className='pr-10'
        onClick={(e) => {
          e.preventDefault();
          if (!open) {
            setOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            disabled={inputProps.disabled}
            id='date-picker'
            variant='ghost'
            className='absolute top-1/2 right-2 size-6 -translate-y-1/2'
          >
            <CalendarIcon className='size-3.5' />
            <span className='sr-only'>{inputProps.placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className='w-auto overflow-hidden p-0'
          align='end'
          alignOffset={-8}
          sideOffset={10}
        >
          <Calendar
            mode='single'
            captionLayout='dropdown'
            locale={es}
            month={month}
            onMonthChange={setMonth}
            onSelect={(date) => {
              if (!date) {
                return;
              }

              setValue(formatDate(date));
              setOpen(false);

              if (date) {
                onSelectAction(date);
              }
            }}
            {...inputProps}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
