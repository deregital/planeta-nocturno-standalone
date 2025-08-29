import type { ComponentProps } from 'react';

import PhoneInput from 'react-phone-number-input';
import esPhoneLocale from 'react-phone-number-input/locale/es';

import GenericInputWithLabel from '@/components/common/GenericInputWithLabel';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PhoneInputWithLabelProps extends ComponentProps<typeof PhoneInput> {
  label: string;
  id: string;
  error?: string;
}

export default function PhoneInputWithLabel({
  label,
  id,
  className,
  error,
  ...inputProps
}: PhoneInputWithLabelProps) {
  return (
    <GenericInputWithLabel
      label={label}
      id={id}
      className={className}
      required={inputProps.required}
      error={error}
    >
      <PhoneInput
        labels={inputProps.labels ?? esPhoneLocale}
        defaultCountry={inputProps.defaultCountry ?? 'AR'}
        className={cn(
          error
            ? '[&_[data-slot="input"]]:border-2 [&_[data-slot="input"]]:border-red-500'
            : '[&_[data-slot="input"]]:border-stroke',
        )}
        inputComponent={Input}
        {...inputProps}
      />
    </GenericInputWithLabel>
  );
}
