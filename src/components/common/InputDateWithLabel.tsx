import { format } from 'date-fns';

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
};

export default function InputDateWithLabel({
  label,
  error,
  onChange,
  selected,
  ...inputProps
}: InputDateWithLabelProps) {
  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    // Format date in local timezone using date-fns
    return format(date, 'yyyy-MM-dd');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      // Parse date in local timezone to avoid timezone conversion issues
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      // Verificar que la fecha sea válida
      if (!isNaN(date.getTime())) {
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
        type='date'
        value={formatDateForInput(selected)}
        onChange={handleInputChange}
      />
    </GenericInputWithLabel>
  );
}
