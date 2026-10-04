'use client';

import Color from 'color';
import { Check, Shuffle } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ColorPicker,
  ColorPickerHue,
  ColorPickerSelection,
} from '@/components/ui/shadcn-io/color-picker';
import { getTextColorByBg, TAG_COLOR_PRESETS } from '@/lib/control/tag-colors';
import { cn } from '@/lib/utils';
import { randomColor } from '@/lib/utils-client';

export default function TagColorField({
  name,
  color,
  onChange,
  disabled,
}: {
  name: string;
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  const normalizedColor = color.toUpperCase();

  const handlePickerChange = useCallback(
    (rgba: unknown) => {
      if (Array.isArray(rgba) && rgba.length >= 3) {
        onChange(Color.rgb(rgba[0], rgba[1], rgba[2]).hex());
      }
    },
    [onChange],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          disabled={disabled}
          className='inline-flex h-10 w-full min-w-0 cursor-pointer items-center justify-center rounded-full px-4 text-base font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-48'
          style={{
            backgroundColor: color,
            color: getTextColorByBg(color),
          }}
          title='Cambiar color'
          aria-label='Cambiar color de la etiqueta'
        >
          <span className={cn('truncate', !name.trim() && 'opacity-50')}>
            {name.trim() || 'Vista previa'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className='grid w-64 max-w-[calc(100vw-2rem)] gap-3 p-3'
        align='end'
        collisionPadding={16}
      >
        <div className='grid grid-cols-6 justify-items-center gap-2'>
          {TAG_COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type='button'
              onClick={() => onChange(preset)}
              className='inline-flex size-7 cursor-pointer items-center justify-center rounded-full transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'
              style={{ backgroundColor: preset }}
              aria-label={`Color ${preset}`}
              aria-pressed={normalizedColor === preset}
            >
              {normalizedColor === preset && (
                <Check
                  className='size-4'
                  style={{ color: getTextColorByBg(preset) }}
                />
              )}
            </button>
          ))}
        </div>
        <ColorPicker value={color} onChange={handlePickerChange}>
          <div className='h-32 w-full'>
            <ColorPickerSelection />
          </div>
          <ColorPickerHue />
        </ColorPicker>
        <div className='flex items-center justify-between gap-2'>
          <span className='font-mono text-xs text-gray-500'>
            {normalizedColor}
          </span>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => onChange(randomColor().toUpperCase())}
          >
            <Shuffle />
            Aleatorio
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
