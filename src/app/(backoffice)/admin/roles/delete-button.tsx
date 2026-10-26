'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trpc } from '@/server/trpc/client';

export default function DeleteRoleButton({
  roleId,
  roleName,
  userCount,
}: {
  roleId: string;
  roleName: string;
  userCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const deleteRole = trpc.accessRole.delete.useMutation({
    onSuccess: () => {
      toast.success('Rol eliminado');
      setOpen(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='destructiveGhost' size='sm'>
          <Trash2 />
          Eliminar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar rol</DialogTitle>
          <DialogDescription>
            {userCount > 0
              ? `El rol ${roleName} tiene ${userCount} usuario(s) asignado(s). Asignales otro rol antes de eliminarlo.`
              : `Se eliminará el rol ${roleName}. Esta acción no se puede deshacer.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant='destructive'
            disabled={userCount > 0}
            loading={deleteRole.isPending}
            onClick={() => deleteRole.mutate(roleId)}
          >
            Eliminar rol
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
