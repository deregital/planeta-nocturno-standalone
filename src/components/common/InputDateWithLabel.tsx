import GenericInputWithLabel from '@/components/common/GenericInputWithLabel';
import { DatePicker } from '@/components/ui/date-picker';

type InputDateWithLabelProps = Omit<
  React.ComponentProps<typeof DatePicker>,
  'onSelectAction'
> & {
  label: string;
  onChange: (date: Date) => void;
  id: string;
  error?: string;
};

export default function InputDateWithLabel({
  label,
  id,
  className,
  error,
  onChange,
  ...inputProps
}: InputDateWithLabelProps) {
  return (
    <GenericInputWithLabel
      label={label}
      id={id}
      className={className}
      required={inputProps.required}
      error={error}
    >
      <DatePicker onSelectAction={onChange} {...inputProps} />
    </GenericInputWithLabel>
  );
}
