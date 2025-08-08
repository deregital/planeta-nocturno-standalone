import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InputWithLabelProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

export default function InputWithLabel({
  label,
  id,
  ...inputProps
}: InputWithLabelProps) {
  return (
    <div className='flex flex-col gap-1'>
      <Label htmlFor={id} className='pl-1 text-pn-accent gap-[2px]'>
        {label}
        {inputProps.required && <span className='text-red-500'>*</span>}
      </Label>
      <Input id={id} {...inputProps} className='border-pn-gray py-[20px]' />
    </div>
  );
}
