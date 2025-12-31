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

export default function InputDateWithLabel({
  label,
  error,
  onChange,
  selected,
  dateType = 'date',
  ...inputProps
}: InputDateWithLabelProps) {
  const formatDateForInput = (date: Date | undefined): string => {
    if (!date || !isValid(date)) return '';
    // Format date in local timezone using date-fns
    if (dateType === 'datetime-local') {
      return format(date, "yyyy-MM-dd'T'HH:mm");
    }
    return format(date, 'yyyy-MM-dd');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      let date: Date;

      if (dateType === 'datetime-local') {
        // Parse datetime-local format: YYYY-MM-DDTHH:mm using date-fns
        date = parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
      } else {
        // Parse date format: YYYY-MM-DD using date-fns to avoid timezone issues
        date = parse(value, 'yyyy-MM-dd', new Date());
      }

      // Verificar que la fecha sea válida
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
        value={formatDateForInput(selected)}
        onChange={handleInputChange}
      />
    </GenericInputWithLabel>
  );
}
