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
    return date.toISOString().split('T')[0];
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      const date = new Date(value);
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
