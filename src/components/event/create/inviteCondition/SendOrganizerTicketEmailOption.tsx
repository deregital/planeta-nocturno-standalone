import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type SendOrganizerTicketEmailOptionProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function SendOrganizerTicketEmailOption({
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: SendOrganizerTicketEmailOptionProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Input
        id='sendOrganizerTicketEmail'
        type='checkbox'
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className='w-6 cursor-pointer'
        disabled={disabled}
      />
      <Label className='text-sm'>
        Enviar tickets por correo a cada organizador al crear el evento
      </Label>
    </div>
  );
}
