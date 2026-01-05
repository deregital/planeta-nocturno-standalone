import { Check, Trash2 } from 'lucide-react';

import { EditTicketingUserModal } from '@/components/event/create/EditTicketingUserModal';
import { Button } from '@/components/ui/button';

export function UserBox({
  id,
  name,
  remove,
  disabled,
  onUserUpdated,
}: {
  id: string;
  name: string;
  remove: () => void;
  disabled: boolean;
  onUserUpdated?: (updatedName: string) => void;
}) {
  return (
    <div className='flex justify-between items-center pl-3 border rounded-md border-accent'>
      <p className='text-base'>{name}</p>
      {disabled ? (
        <Button variant={'destructiveGhost'} className='text-accent' disabled>
          <Check />
        </Button>
      ) : (
        <>
          <div className='pl-2'>
            <EditTicketingUserModal userId={id} onSuccess={onUserUpdated} />
          </div>
          <Button variant={'destructiveGhost'} onClick={remove}>
            <Trash2 />
          </Button>
        </>
      )}
    </div>
  );
}
