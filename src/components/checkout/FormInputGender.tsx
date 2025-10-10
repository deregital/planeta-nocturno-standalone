import { type PurchaseActionState } from '@/app/(client)/checkout/action';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function FormInputGender({
  tag,
  state,
}: {
  tag: string;
  state: PurchaseActionState;
}) {
  return (
    <div className='flex flex-col gap-1'>
      <Label className='pl-1 text-accent gap-0.5' htmlFor={tag}>
        Género<span className='text-red-500'>*</span>
      </Label>
      <Select name={tag} required defaultValue={state.formData?.[tag]}>
        <SelectTrigger className='w-full py-2 border-stroke'>
          <SelectValue placeholder='Selecciona tu género' />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Género</SelectLabel>
            <SelectItem value='male'>Masculino</SelectItem>
            <SelectItem value='female'>Femenino</SelectItem>
            <SelectItem value='other'>Otro</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {typeof state.errors === 'object' &&
        state.errors !== null &&
        (state.errors as Record<string, string>)[tag] && (
          <p className='pl-1 font-bold text-xs text-red-500'>
            {(state.errors as Record<string, string>)[tag]}
          </p>
        )}
    </div>
  );
}
