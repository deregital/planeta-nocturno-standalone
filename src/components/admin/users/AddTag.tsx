'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
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
import { trpc } from '@/server/trpc/client';

interface AddTagProps {
  userId: string;
  currentUserTagIds?: string[];
}

export function AddTag({ userId, currentUserTagIds = [] }: AddTagProps) {
  const [open, setOpen] = useState(false);
  const [addedTagIds, setAddedTagIds] = useState<string[]>([]);
  const router = useRouter();
  const utils = trpc.useUtils();

  // Sync addedTagIds with currentUserTagIds - remove tags that are no longer in currentUserTagIds
  useEffect(() => {
    setAddedTagIds((prev) =>
      prev.filter((tagId) => currentUserTagIds.includes(tagId)),
    );
  }, [currentUserTagIds]);

  const { data: tags, isLoading } = trpc.tag.getAll.useQuery();
  const addUserToTagMutation = trpc.tag.addUserToTag.useMutation({
    onSuccess: (_, variables) => {
      toast.success('Usuario agregado al grupo exitosamente');
      // Add the tag to the local list to immediately filter it out
      setAddedTagIds((prev) => [...prev, variables.tagId]);
      utils.user.getByRole.invalidate('ORGANIZER');
      utils.tag.getAll.invalidate();
      router.refresh();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al agregar usuario al grupo');
    },
  });

  // Filter out tags the user already has (both from props and locally added)
  const allExcludedTagIds = [...currentUserTagIds, ...addedTagIds];
  const availableTags =
    tags?.filter((tag) => !allExcludedTagIds.includes(tag.id)) || [];

  const handleSelectTag = (tagId: string) => {
    addUserToTagMutation.mutate({
      userId,
      tagId,
    });
  };

  if (isLoading) {
    return null;
  }

  if (availableTags.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Badge
          variant='outline'
          className='cursor-pointer hover:bg-accent-light/50 transition-all'
        >
          <Plus />
        </Badge>
      </PopoverTrigger>
      <PopoverContent className='p-0 w-[200px]' align='start'>
        <Command>
          <CommandInput placeholder='Buscar grupo...' />
          <CommandList>
            <CommandEmpty>No se encontró ningún grupo</CommandEmpty>
            <CommandGroup>
              {availableTags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.name}
                  onSelect={() => handleSelectTag(tag.id)}
                  disabled={addUserToTagMutation.isPending}
                >
                  {tag.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
