import { Check, Trash2 } from 'lucide-react';

import { EditTicketingUserModal } from '@/components/event/create/EditTicketingUserModal';
import { Can } from '@/components/rbac/Can';
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
          <Can permission='users:update'>
            <div className='pl-2'>
              <EditTicketingUserModal userId={id} onSuccess={onUserUpdated} />
            </div>
          </Can>
          <Button variant={'destructiveGhost'} onClick={remove}>
            <Trash2 />
          </Button>
        </>
      )}
    </div>
  );
}
