import GenericInputWithLabel from '@/components/common/GenericInputWithLabel';
import { Input } from '@/components/ui/input';

interface InputWithLabelProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
}

export default function InputWithLabel({
  label,
  id,
  className,
  error,
  ...inputProps
}: InputWithLabelProps) {
  return (
    <GenericInputWithLabel
      label={label}
      id={id}
      className={className}
      required={inputProps.required}
      error={error}
    >
      <Input id={id} {...inputProps} className='border-stroke py-2' />
    </GenericInputWithLabel>
  );
}
