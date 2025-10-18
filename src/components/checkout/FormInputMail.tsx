import { type PurchaseActionState } from '@/app/(client)/checkout/action';
import InputWithLabel from '@/components/common/InputWithLabel';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  tag: string;
  state: PurchaseActionState;
}

export default function FormInputMail({
  tag,
  state,
  defaultValue,
  ...inputProps
}: InputProps) {
  return (
    <InputWithLabel
      name={tag}
      id={tag}
      label='Mail'
      type='email'
      required
      defaultValue={state.formData?.[tag] ?? defaultValue}
      error={
        typeof state.errors === 'object' && state.errors !== null
          ? (state.errors as Record<string, string>)[tag]
          : undefined
      }
      {...inputProps}
    />
  );
}
