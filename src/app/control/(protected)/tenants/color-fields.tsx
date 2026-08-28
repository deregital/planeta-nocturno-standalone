'use client';

import { useState } from 'react';

import { Label } from '@/components/ui/label';
import styles from '@/app/control/(protected)/tenants/color-fields.module.css';

export default function TenantColorFields({
  initialHue,
  initialSaturation,
  errors,
}: {
  initialHue: string;
  initialSaturation: string;
  errors?: { hue?: string; saturation?: string };
}) {
  const [hue, setHue] = useState(initialHue);
  const [saturation, setSaturation] = useState(initialSaturation);
  const selectedColor = `hsl(${hue} ${saturation}% 50%)`;

  return (
    <div className='space-y-4 md:col-span-2'>
      <div
        className='size-12 rounded-lg border border-stroke'
        style={{ backgroundColor: selectedColor }}
      />
      <RangeField
        label='Tono'
        name='hue'
        value={hue}
        max={360}
        onChange={setHue}
        gradient='linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))'
        error={errors?.hue}
      />
      <RangeField
        label='Saturación'
        name='saturation'
        value={saturation}
        max={100}
        onChange={setSaturation}
        gradient={`linear-gradient(to right, hsl(${hue} 0% 50%), hsl(${hue} 100% 50%))`}
        error={errors?.saturation}
      />
    </div>
  );
}

function RangeField({
  label,
  name,
  value,
  max,
  onChange,
  gradient,
  error,
}: {
  label: string;
  name: 'hue' | 'saturation';
  value: string;
  max: number;
  onChange: (value: string) => void;
  gradient: string;
  error?: string;
}) {
  return (
    <div className='space-y-2'>
      <Label htmlFor={name}>{label}</Label>
      <input
        id={name}
        name={name}
        type='range'
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={styles.range}
        style={{ '--range-gradient': gradient } as React.CSSProperties}
        aria-invalid={Boolean(error)}
      />
      {error && <p className='text-xs font-medium text-red-600'>{error}</p>}
    </div>
  );
}
