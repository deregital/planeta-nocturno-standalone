'use client';

import type { TenantTag } from '@/server/control/tenant-tags';

import { Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  createTenantTag,
  deleteTenantTag,
  updateTenantTag,
} from '@/app/control/(protected)/tenants/tag-actions';
import TagColorField from '@/components/control/TagColorField';
import TenantTagBadge from '@/components/control/TenantTagBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { randomColor } from '@/lib/utils-client';
import { TENANT_TAG_NAME_MAX_LENGTH } from '@/server/schemas/control-tenant-tag';

export default function TenantTagsManager({ tags }: { tags: TenantTag[] }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setEditingId(null);
          setCreating(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant='ghost' className='flex-1 sm:flex-none'>
          <Tags />
          Etiquetas
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto p-4 sm:max-w-xl sm:p-6'>
        <DialogHeader>
          <DialogTitle>Mis etiquetas</DialogTitle>
          <DialogDescription>
            Organizá tus plataformas con etiquetas. Son personales: solo vos
            podés verlas.
          </DialogDescription>
        </DialogHeader>

        {creating ? (
          <TagEditor
            submitLabel='Crear'
            onCancel={() => setCreating(false)}
            onSubmit={async (values) => {
              const result = await createTenantTag(values);
              if (result.error) return result.error;
              toast.success('Etiqueta creada');
              setCreating(false);
            }}
          />
        ) : (
          <Button
            type='button'
            variant='outline'
            className='w-full'
            onClick={() => {
              setEditingId(null);
              setCreating(true);
            }}
          >
            <Plus />
            Nueva etiqueta
          </Button>
        )}

        <div className='grid grid-cols-[minmax(0,1fr)] gap-2'>
          {tags.length === 0 && !creating && (
            <p className='py-6 text-center text-sm text-gray-500'>
              Todavía no creaste etiquetas.
            </p>
          )}
          {tags.map((tag) =>
            editingId === tag.id ? (
              <TagEditor
                key={tag.id}
                initialName={tag.name}
                initialColor={tag.color}
                submitLabel='Guardar'
                onCancel={() => setEditingId(null)}
                onSubmit={async (values) => {
                  const result = await updateTenantTag({
                    id: tag.id,
                    ...values,
                  });
                  if (result.error) return result.error;
                  toast.success('Etiqueta actualizada');
                  setEditingId(null);
                }}
              />
            ) : (
              <TagRow
                key={tag.id}
                tag={tag}
                onEdit={() => {
                  setCreating(false);
                  setEditingId(tag.id);
                }}
              />
            ),
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TagRow({ tag, onEdit }: { tag: TenantTag; onEdit: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteTenantTag(tag.id);
      if (result.error) {
        toast.error(result.error);
        setConfirmDelete(false);
        return;
      }
      toast.success('Etiqueta eliminada');
    });
  }

  return (
    <div className='flex min-w-0 items-center gap-2 rounded-lg border border-stroke px-3 py-2 sm:gap-3'>
      <div className='flex min-w-0 flex-1 items-center gap-3'>
        <TenantTagBadge
          name={tag.name}
          color={tag.color}
          className='h-8 max-w-full px-4 text-sm sm:max-w-56'
        />
        <span className='hidden shrink-0 text-sm whitespace-nowrap text-gray-500 sm:inline'>
          {tag.tenantCount === 1
            ? '1 plataforma'
            : `${tag.tenantCount} plataformas`}
        </span>
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        {!confirmDelete && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={onEdit}
            aria-label={`Editar ${tag.name}`}
          >
            <Pencil />
          </Button>
        )}
        {confirmDelete && !pending && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => setConfirmDelete(false)}
            aria-label='Cancelar'
          >
            <X className='sm:hidden' />
            <span className='hidden sm:inline'>Cancelar</span>
          </Button>
        )}
        <Button
          type='button'
          variant='destructiveGhost'
          size={confirmDelete ? 'sm' : 'icon'}
          disabled={pending}
          onClick={handleDelete}
          aria-label={`Eliminar ${tag.name}`}
        >
          <Trash2 />
          {confirmDelete &&
            (pending ? (
              'Eliminando...'
            ) : (
              <>
                <span className='sm:hidden'>¿Seguro?</span>
                <span className='hidden sm:inline'>¿Estás seguro?</span>
              </>
            ))}
        </Button>
      </div>
    </div>
  );
}

function TagEditor({
  initialName = '',
  initialColor,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialName?: string;
  initialColor?: string;
  submitLabel: string;
  onSubmit: (values: {
    name: string;
    color: string;
  }) => Promise<string | undefined>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(
    () => initialColor ?? randomColor().toUpperCase(),
  );
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const submitError = await onSubmit({ name, color });
      if (submitError) setError(submitError);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-stroke bg-gray-50 p-3'
    >
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <Input
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
          maxLength={TENANT_TAG_NAME_MAX_LENGTH}
          placeholder='Nombre de la etiqueta'
          disabled={pending}
          aria-invalid={Boolean(error)}
          className='h-10 min-w-0 bg-white'
        />
        <TagColorField
          name={name}
          color={color}
          onChange={setColor}
          disabled={pending}
        />
      </div>
      {error && <p className='text-sm font-medium text-red-600'>{error}</p>}
      <div className='flex flex-wrap justify-end gap-2'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={onCancel}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button
          type='submit'
          variant='accent'
          size='sm'
          disabled={pending || !name.trim()}
        >
          {pending ? 'Guardando...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
