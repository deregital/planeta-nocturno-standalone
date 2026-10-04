'use client';

import type { TenantTag } from '@/server/control/tenant-tags';

import { Check, Plus, Tag } from 'lucide-react';
import { useMemo, useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  createTenantTag,
  setTenantTagAssignment,
} from '@/app/control/(protected)/tenants/tag-actions';
import TenantTagBadge from '@/components/control/TenantTagBadge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { randomColor } from '@/lib/utils-client';
import { TENANT_TAG_NAME_MAX_LENGTH } from '@/server/schemas/control-tenant-tag';

type AssignmentChange = { tagId: string; assigned: boolean };

export default function TenantTagsCell({
  tenantId,
  tenantName,
  tags,
  assignedTagIds,
}: {
  tenantId: number;
  tenantName: string;
  tags: TenantTag[];
  assignedTagIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [optimisticTagIds, applyChange] = useOptimistic(
    assignedTagIds,
    (current: string[], { tagId, assigned }: AssignmentChange) =>
      assigned
        ? [...new Set([...current, tagId])]
        : current.filter((id) => id !== tagId),
  );

  const assignedTags = useMemo(
    () => tags.filter((tag) => optimisticTagIds.includes(tag.id)),
    [optimisticTagIds, tags],
  );

  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const visibleTags = normalizedQuery
    ? tags.filter((tag) =>
        tag.name.toLocaleLowerCase('es').includes(normalizedQuery),
      )
    : tags;
  const canCreate =
    normalizedQuery.length > 0 &&
    !tags.some((tag) => tag.name.toLocaleLowerCase('es') === normalizedQuery);

  function toggleTag(tagId: string) {
    const assigned = !optimisticTagIds.includes(tagId);
    startTransition(async () => {
      applyChange({ tagId, assigned });
      const result = await setTenantTagAssignment({
        tagId,
        tenantId,
        assigned,
      });
      if (result.error) toast.error(result.error);
    });
  }

  function createAndAssign() {
    const name = query.trim();
    startTransition(async () => {
      const created = await createTenantTag({
        name,
        color: randomColor().toUpperCase(),
      });
      if (created.error || !created.tag) {
        toast.error(created.error ?? 'No se pudo crear la etiqueta');
        return;
      }
      setQuery('');
      applyChange({ tagId: created.tag.id, assigned: true });
      const result = await setTenantTagAssignment({
        tagId: created.tag.id,
        tenantId,
        assigned: true,
      });
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className='flex max-w-64 flex-wrap items-center gap-1'>
      {assignedTags.map((tag) => (
        <TenantTagBadge key={tag.id} name={tag.name} color={tag.color} />
      ))}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <button
            type='button'
            className='inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-accent hover:text-accent'
            aria-label={`Editar etiquetas de ${tenantName}`}
          >
            {assignedTags.length === 0 ? (
              <>
                <Tag className='size-3' />
                Etiquetar
              </>
            ) : (
              <Plus className='size-3' />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className='w-64 max-w-[calc(100vw-2rem)] p-0'
          align='start'
          collisionPadding={16}
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder='Buscar o crear etiqueta'
              maxLength={TENANT_TAG_NAME_MAX_LENGTH}
            />
            <CommandList>
              {!canCreate && (
                <CommandEmpty>
                  {tags.length === 0
                    ? 'Escribí un nombre para crear tu primera etiqueta.'
                    : 'No hay etiquetas que coincidan.'}
                </CommandEmpty>
              )}
              {visibleTags.length > 0 && (
                <CommandGroup>
                  {visibleTags.map((tag) => {
                    const assigned = optimisticTagIds.includes(tag.id);
                    return (
                      <CommandItem
                        key={tag.id}
                        value={tag.id}
                        onSelect={() => toggleTag(tag.id)}
                        className='cursor-pointer'
                      >
                        <span
                          className='size-3 shrink-0 rounded-full'
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className='flex-1 truncate'>{tag.name}</span>
                        {assigned && <Check className='size-4' />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {canCreate && (
                <CommandGroup>
                  <CommandItem
                    value='__create__'
                    onSelect={createAndAssign}
                    disabled={pending}
                    className='cursor-pointer'
                  >
                    <Plus className='size-4' />
                    <span className='truncate'>
                      Crear &quot;{query.trim()}&quot;
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
