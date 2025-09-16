import { Check, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function UserBox({
  id,
  name,
  remove,
  disabled,
}: {
  id: string;
  name: string;
  remove: () => void;
  disabled: boolean;
}) {
  return (
    <div className='flex justify-between items-center pl-3 gap-2 border rounded-md border-accent'>
      <p className='text-base'>{name}</p>
      {disabled ? (
        <Button variant={'destructiveGhost'} className='text-accent' disabled>
          <Check />
        </Button>
      ) : (
        <Button variant={'destructiveGhost'} onClick={remove}>
          <Trash2 />
        </Button>
      )}
    </div>
  );
}
