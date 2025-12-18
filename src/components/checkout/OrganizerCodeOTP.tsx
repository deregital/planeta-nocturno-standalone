'use client';

import { Loader2 } from 'lucide-react';

import GenericInputWithLabel from '@/components/common/GenericInputWithLabel';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';

interface OrganizerCodeOTPProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
  isValidating?: boolean;
  error?: string;
  label: string;
  id: string;
  required?: boolean;
  organizerName?: string | null;
  discountPercentage?: number | null;
}

// Patrón regex para aceptar solo caracteres hexadecimales (0-9, A-F)
const HEX_REGEX = /^[0-9A-Fa-f]*$/;

export default function OrganizerCodeOTP({
  value,
  onChange,
  disabled = false,
  isValidating = false,
  error,
  label,
  id,
  required,
  organizerName,
  discountPercentage,
}: OrganizerCodeOTPProps) {
  const handleValueChange = (newValue: string) => {
    // Validar que solo contenga caracteres hexadecimales
    if (!HEX_REGEX.test(newValue)) {
      return; // Ignorar caracteres no hexadecimales
    }

    // Convertir a mayúsculas y limitar a 6 caracteres
    const upperValue = newValue.toUpperCase().slice(0, 6);
    onChange(upperValue);
  };

  const isValid = organizerName && !error && value.length === 6;

  return (
    <GenericInputWithLabel
      label={label}
      id={id}
      required={required}
      error={error}
    >
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-3'>
          <div
            className={cn(
              error ? '[&_div]:border-red-500' : '',
              isValid ? '[&_div]:border-green-500' : '',
            )}
          >
            <InputOTP
              maxLength={6}
              value={value.toUpperCase()}
              onChange={handleValueChange}
              disabled={disabled}
              inputMode='text'
              type='text'
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {isValidating && (
            <Loader2 className='h-5 w-5 animate-spin text-accent shrink-0' />
          )}
        </div>
        {isValid && (
          <div className='flex items-center gap-2 text-sm pl-1'>
            <span className='text-green-600 font-medium'>{organizerName}</span>
            {discountPercentage !== null &&
              discountPercentage !== undefined &&
              discountPercentage > 0 && (
                <span className='text-green-600 font-semibold'>
                  ({discountPercentage}% desc.)
                </span>
              )}
          </div>
        )}
      </div>
    </GenericInputWithLabel>
  );
}
