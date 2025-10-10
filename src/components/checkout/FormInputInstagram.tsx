import { type PurchaseActionState } from '@/app/(client)/checkout/action';
import InputWithLabel from '@/components/common/InputWithLabel';

export default function FormInputInstagram({
  tag,
  state,
}: {
  tag: string;
  state: PurchaseActionState;
}) {
  return (
    <InputWithLabel
      name={tag}
      id={tag}
      label='Instagram'
      type='text'
      placeholder='@'
      defaultValue={state.formData?.[tag]}
      error={
        typeof state.errors === 'object' && state.errors !== null
          ? (state.errors as Record<string, string>)[tag]
          : undefined
      }
    />
  );
}
