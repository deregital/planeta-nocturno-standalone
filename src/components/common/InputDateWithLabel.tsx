import { isValid, parse } from 'date-fns';
import { useEffect, useRef, useState } from 'react';

import GenericInputWithLabel from '@/components/common/GenericInputWithLabel';
import { Input } from '@/components/ui/input';

type InputDateWithLabelProps = Omit<
  React.ComponentProps<typeof Input>,
  'onChange' | 'value' | 'type' | 'id'
> & {
  label: string;
  id: string;
  onChange: (date: Date) => void;
  error?: string;
  selected?: Date;
  dateType?: 'date' | 'datetime-local';
};

function formatDateForInput(date: Date | undefined, dateType: string): string {
  if (!date || !isValid(date)) return '';
  const y = String(date.getFullYear()).padStart(4, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (dateType === 'datetime-local') {
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${min}`;
  }
  return `${y}-${mo}-${d}`;
}

export default function InputDateWithLabel({
  label,
  error,
  onChange,
  selected,
  dateType = 'date',
  ...inputProps
}: InputDateWithLabelProps) {
  const [inputValue, setInputValue] = useState(
    formatDateForInput(selected, dateType),
  );
  const isUserInput = useRef(false);

  useEffect(() => {
    if (isUserInput.current) {
      isUserInput.current = false;
      return;
    }
    setInputValue(formatDateForInput(selected, dateType));
  }, [selected, dateType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (value) {
      const date =
        dateType === 'datetime-local'
          ? parse(value, "yyyy-MM-dd'T'HH:mm", new Date())
          : parse(value, 'yyyy-MM-dd', new Date());

      if (isValid(date)) {
        isUserInput.current = true;
        onChange(date);
      }
    }
  };

  return (
    <GenericInputWithLabel
      label={label}
      id={inputProps.id || ''}
      className={inputProps.className}
      required={inputProps.required}
      error={error}
    >
      <Input
        {...inputProps}
        type={dateType}
        value={inputValue}
        onChange={handleInputChange}
      />
    </GenericInputWithLabel>
  );
}
