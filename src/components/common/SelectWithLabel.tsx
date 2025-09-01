import GenericInputWithLabel from '@/components/common/GenericInputWithLabel';
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectItem,
  SelectContent,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SelectWithLabelProps extends React.ComponentProps<typeof Select> {
  label: string;
  id: string;
  required?: boolean;
  values: Array<{
    label: string;
    value: string;
  }>;
  className?: string;
  divClassName?: string;
  error?: string;
  readOnly?: boolean;
}

export default function SelectWithLabel({
  label,
  id,
  required,
  values,
  className,
  divClassName,
  error,
  readOnly,
  ...selectProps
}: SelectWithLabelProps) {
  return (
    <GenericInputWithLabel
      label={label}
      id={id}
      required={required}
      className={divClassName}
      error={error}
    >
      <Select {...selectProps} disabled={readOnly}>
        <SelectContent>
          {values.map((value) => (
            <SelectItem key={value.value} value={value.value}>
              {value.label}
            </SelectItem>
          ))}
        </SelectContent>
        <SelectTrigger
          className={cn(
            className,
            'bg-white border-stroke',
            error && 'border-red-500 border-2',
            readOnly && 'cursor-default',
          )}
        >
          <SelectValue placeholder='Selecciona una opción' />
        </SelectTrigger>
      </Select>
    </GenericInputWithLabel>
  );
}
