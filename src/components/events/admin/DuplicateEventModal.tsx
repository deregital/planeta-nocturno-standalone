'use client';

import { CopyIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { trpc } from '@/server/trpc/client';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Mientras se escribe: minúsculas, sin acentos, espacios → guiones. */
function sanitizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-');
}

export default function DuplicateEventModal({
  eventId,
  eventName,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  hideTrigger = false,
}: {
  eventId: string;
  eventName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;

  const [slug, setSlug] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);

  const suggestion = trpc.events.getDuplicateSlugSuggestion.useQuery(eventId, {
    enabled: open,
    staleTime: 0,
  });

  // Cada vez que se abre, arranca con la URL sugerida.
  useEffect(() => {
    if (open && suggestion.data) {
      setSlug(suggestion.data);
      setSlugError(null);
    }
  }, [open, suggestion.data]);

  const duplicateEvent = trpc.events.duplicate.useMutation({
    onSuccess: () => {
      posthog.capture('event_duplicated', { source_event_id: eventId });
      toast.success('Evento duplicado correctamente');
      setOpen(false);
      router.refresh();
    },
    onError: (error) => {
      if (error.data?.code === 'CONFLICT') {
        setSlugError(error.message);
        return;
      }
      toast.error(error.message);
    },
  });

  function handleDuplicate() {
    const finalSlug = slug.replace(/^-+|-+$/g, '');
    if (!SLUG_PATTERN.test(finalSlug)) {
      setSlugError(
        'El link sólo puede tener letras minúsculas, números y guiones',
      );
      return;
    }
    setSlug(finalSlug);
    duplicateEvent.mutate({ id: eventId, slug: finalSlug });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant={'ghost'} size={'icon'}>
                <CopyIcon className='w-4 h-4 text-on-accent' />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Duplicar evento</TooltipContent>
        </Tooltip>
      )}
      <DialogContent>
        <DialogTitle className='text-lg font-bold'>
          ¿Duplicar este evento?
        </DialogTitle>
        <DialogDescription>
          Se creará una copia de <span className='font-bold'>{eventName}</span>{' '}
          con el nombre &quot;{eventName} (copia)&quot;. La copia quedará
          desactivada de la ticketera hasta que la actives.{' '}
          <span className='font-bold'>
            Revisá bien el link: no se podrá cambiar después de crear el evento.
          </span>
        </DialogDescription>

        <form
          className='flex min-w-0 flex-col gap-2'
          onSubmit={(e) => {
            e.preventDefault();
            handleDuplicate();
          }}
        >
          <Label htmlFor='duplicate-event-slug'>Link del nuevo evento</Label>
          <div className='flex min-w-0 items-center gap-1'>
            <span className='shrink-0 text-sm text-accent/70'>/event/</span>
            <Input
              id='duplicate-event-slug'
              value={slug}
              onChange={(e) => {
                setSlug(sanitizeSlugInput(e.target.value));
                setSlugError(null);
              }}
              placeholder={
                suggestion.isLoading ? 'Cargando…' : 'nombre-del-evento'
              }
              disabled={suggestion.isLoading}
              aria-invalid={!!slugError}
              autoComplete='off'
              autoCapitalize='none'
              spellCheck={false}
            />
          </div>
          {slugError && (
            <p className='break-words text-sm text-destructive'>{slugError}</p>
          )}
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant={'ghost'}>Cancelar</Button>
          </DialogClose>
          <Button
            onClick={handleDuplicate}
            loading={duplicateEvent.isPending}
            disabled={suggestion.isLoading || slug.length === 0}
          >
            Duplicar evento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
