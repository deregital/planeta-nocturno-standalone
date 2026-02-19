import { format, isValid, parse } from 'date-fns';

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
  if (dateType === 'datetime-local') {
    return format(date, "yyyy-MM-dd'T'HH:mm");
  }
  return format(date, 'yyyy-MM-dd');
}

export default function InputDateWithLabel({
  label,
  error,
  onChange,
  selected,
  dateType = 'date',
  ...inputProps
}: InputDateWithLabelProps) {
  const defaultValue = formatDateForInput(selected, dateType);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      const fmt =
        dateType === 'datetime-local' ? "yyyy-MM-dd'T'HH:mm" : 'yyyy-MM-dd';
      const date = parse(value, fmt, new Date());

      if (isValid(date)) {
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
        defaultValue={defaultValue}
        onChange={handleInputChange}
      />
    </GenericInputWithLabel>
  );
}
