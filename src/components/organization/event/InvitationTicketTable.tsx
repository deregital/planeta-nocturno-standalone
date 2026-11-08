'use client';

import { type StrictColumnDef } from '@tanstack/react-table';
import { Loader2, ShareIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';
import { INVITE_CODE_QUERY_PARAM } from '@/server/utils/constants';

type InvitationCode = RouterOutputs['organizer']['getMyCodesNotUsed'][number];

function InvitationSharedSwitch({
  code,
  eventId,
  shared,
  onSharedChange,
}: {
  code: string;
  eventId: string;
  shared: boolean;
  onSharedChange: (code: string, shared: boolean) => void;
}) {
  const setCodeShared = trpc.organizer.setCodeShared.useMutation({
    onError: (_error, variables) => {
      onSharedChange(variables.code, !variables.shared);
      toast.error('No se pudo actualizar el estado de compartido');
    },
  });

  return (
    <span className='inline-flex items-center gap-2'>
      <Switch
        checked={shared}
        disabled={setCodeShared.isPending}
        className='cursor-pointer **:data-[slot=switch-thumb]:duration-200 **:data-[slot=switch-thumb]:ease-out'
        onCheckedChange={(checked) => {
          onSharedChange(code, checked);
          setCodeShared.mutate({ eventId, code, shared: checked });
        }}
        aria-label={
          shared ? 'Marcar como no compartido' : 'Marcar como compartido'
        }
      />
      {setCodeShared.isPending && (
        <Loader2 className='size-3 animate-spin text-accent' />
      )}
    </span>
  );
}

function InvitationSharedWithInput({
  code,
  eventId,
  sharedWith,
  autoFocus,
  onSharedWithChange,
}: {
  code: string;
  eventId: string;
  sharedWith: string;
  autoFocus: boolean;
  onSharedWithChange: (code: string, sharedWith: string) => void;
}) {
  const [draft, setDraft] = useState(sharedWith);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(sharedWith);
  }, [sharedWith]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const setCodeSharedWith = trpc.organizer.setCodeSharedWith.useMutation({
    onError: () => {
      toast.error('No se pudo guardar a quién se compartió');
    },
  });

  function save() {
    const value = draft.trim();
    if (value === sharedWith) {
      setDraft(value);
      return;
    }
    const previous = sharedWith;
    onSharedWithChange(code, value);
    setCodeSharedWith.mutate(
      { eventId, code, sharedWith: value },
      {
        onError: () => {
          onSharedWithChange(code, previous);
          setDraft(previous);
        },
      },
    );
  }

  return (
    <span className='inline-flex items-center gap-2'>
      <Input
        ref={inputRef}
        value={draft}
        maxLength={200}
        placeholder='¿A quién se lo compartiste?'
        aria-label='A quién se compartió'
        className='h-8 min-w-48'
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            setDraft(sharedWith);
            event.currentTarget.blur();
          }
        }}
      />
      {setCodeSharedWith.isPending && (
        <Loader2 className='size-3 animate-spin text-accent' />
      )}
    </span>
  );
}

function buildColumns({
  eventId,
  eventSlug,
  onSharedChange,
  onSharedWithChange,
  onCopy,
  sharingCode,
  lastCopiedCode,
}: {
  eventId: string;
  eventSlug: string;
  onSharedChange: (code: string, shared: boolean) => void;
  onSharedWithChange: (code: string, sharedWith: string) => void;
  onCopy: (code: string) => void;
  sharingCode: string | null;
  lastCopiedCode: string | null;
}): StrictColumnDef<InvitationCode>[] {
  return [
    {
      id: 'id',
      accessorKey: 'shortId',
      header: 'ID',
      cell: ({ row }) => row.original.shortId,
      meta: {
        exportValue: (row) => String(row.original.shortId),
        exportHeader: 'ID',
      },
    },
    {
      id: 'share',
      accessorFn: (row) => row.code,
      meta: {
        exportValue: () => '',
        exportHeader: '',
      },
      header: 'Compartir',
      cell: ({ row }) => {
        function copyToClipboard() {
          // `window` sólo existe en el navegador: leerlo al renderizar rompe el SSR.
          const url = `${window.location.origin}/event/${eventSlug}?${INVITE_CODE_QUERY_PARAM}=${row.original.code}`;
          void navigator.clipboard.writeText(url);
          onCopy(row.original.code);
          toast.success('Enlace copiado al portapapeles');
        }

        return (
          <Button
            type='button'
            variant='ghost'
            className='justify-start gap-2'
            loading={sharingCode === row.original.code}
            onClick={copyToClipboard}
          >
            {row.original.shared
              ? 'Ya compartido (volver a copiar)'
              : 'Copiar ticket'}
            <ShareIcon className='w-4 h-4 shrink-0' />
          </Button>
        );
      },
    },
    {
      id: 'shared',
      accessorKey: 'shared',
      meta: {
        exportValue: (row) => (row.original.shared ? 'Sí' : 'No'),
        exportHeader: 'Compartido',
      },
      header: 'Compartido',
      cell: ({ row }) => (
        <InvitationSharedSwitch
          code={row.original.code}
          eventId={eventId}
          shared={row.original.shared}
          onSharedChange={onSharedChange}
        />
      ),
    },
    {
      id: 'sharedWith',
      accessorFn: (row) => row.sharedWith ?? '',
      meta: {
        exportValue: (row) => row.original.sharedWith ?? '',
        exportHeader: 'Compartido con',
      },
      header: 'Compartido con',
      cell: ({ row }) => {
        const sharedWith = row.original.sharedWith ?? '';
        if (!row.original.shared && !sharedWith) {
          return <span className='text-accent/50'>—</span>;
        }
        return (
          <InvitationSharedWithInput
            code={row.original.code}
            eventId={eventId}
            sharedWith={sharedWith}
            autoFocus={lastCopiedCode === row.original.code}
            onSharedWithChange={onSharedWithChange}
          />
        );
      },
    },
  ];
}

export function InvitationTicketTable({
  codes,
  eventId,
  eventSlug,
}: {
  codes: InvitationCode[];
  eventId: string;
  eventSlug: string;
}) {
  const [sharedByCode, setSharedByCode] = useState(
    () => new Map(codes.map((code) => [code.code, code.shared])),
  );
  const sharedByCodeRef = useRef(sharedByCode);
  sharedByCodeRef.current = sharedByCode;

  useEffect(() => {
    setSharedByCode(new Map(codes.map((code) => [code.code, code.shared])));
  }, [codes]);

  const [sharedWithByCode, setSharedWithByCode] = useState(
    () => new Map(codes.map((code) => [code.code, code.sharedWith ?? ''])),
  );

  useEffect(() => {
    setSharedWithByCode(
      new Map(codes.map((code) => [code.code, code.sharedWith ?? ''])),
    );
  }, [codes]);

  const [lastCopiedCode, setLastCopiedCode] = useState<string | null>(null);

  const [sharingCode, setSharingCode] = useState<string | null>(null);
  const setCodeShared = trpc.organizer.setCodeShared.useMutation({
    onError: (_error, variables) => {
      setSharedByCode((current) => {
        const next = new Map(current);
        next.set(variables.code, !variables.shared);
        return next;
      });
      toast.error('No se pudo actualizar el estado de compartido');
    },
    onSettled: () => setSharingCode(null),
  });

  const setCodeSharedRef = useRef(setCodeShared);
  setCodeSharedRef.current = setCodeShared;

  const handlersRef = useRef({
    onSharedChange: (_code: string, _shared: boolean) => {},
    onSharedWithChange: (_code: string, _sharedWith: string) => {},
    onCopy: (_code: string) => {},
  });

  handlersRef.current = {
    onSharedChange: (code, shared) => {
      setSharedByCode((current) => {
        if ((current.get(code) ?? false) === shared) {
          return current;
        }
        const next = new Map(current);
        next.set(code, shared);
        return next;
      });
    },
    onSharedWithChange: (code, sharedWith) => {
      setSharedWithByCode((current) => {
        if ((current.get(code) ?? '') === sharedWith) {
          return current;
        }
        const next = new Map(current);
        next.set(code, sharedWith);
        return next;
      });
    },
    onCopy: (code) => {
      const alreadyShared = sharedByCodeRef.current.get(code) ?? false;
      handlersRef.current.onSharedChange(code, true);
      setLastCopiedCode(code);
      if (!alreadyShared) {
        setSharingCode(code);
        setCodeSharedRef.current.mutate({ eventId, code, shared: true });
      }
    },
  };

  const tableData = useMemo(
    () =>
      codes.map((code) => ({
        ...code,
        shared: sharedByCode.get(code.code) ?? code.shared,
        sharedWith: sharedWithByCode.get(code.code) ?? code.sharedWith,
      })),
    [codes, sharedByCode, sharedWithByCode],
  );

  const tableColumns = useMemo(
    () =>
      buildColumns({
        eventId,
        eventSlug,
        onSharedChange: (code, shared) =>
          handlersRef.current.onSharedChange(code, shared),
        onSharedWithChange: (code, sharedWith) =>
          handlersRef.current.onSharedWithChange(code, sharedWith),
        onCopy: (code) => handlersRef.current.onCopy(code),
        sharingCode,
        lastCopiedCode,
      }),
    [eventId, eventSlug, sharingCode, lastCopiedCode],
  );

  return <DataTable columns={tableColumns} data={tableData} />;
}
