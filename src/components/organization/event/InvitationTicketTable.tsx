'use client';

import { type StrictColumnDef } from '@tanstack/react-table';
import { ShareIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
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
    <Switch
      checked={shared}
      className='cursor-pointer **:data-[slot=switch-thumb]:duration-200 **:data-[slot=switch-thumb]:ease-out'
      onCheckedChange={(checked) => {
        onSharedChange(code, checked);
        setCodeShared.mutate({ eventId, code, shared: checked });
      }}
      aria-label={
        shared ? 'Marcar como no compartido' : 'Marcar como compartido'
      }
    />
  );
}

function buildColumns({
  eventId,
  eventSlug,
  onSharedChange,
  onCopy,
}: {
  eventId: string;
  eventSlug: string;
  onSharedChange: (code: string, shared: boolean) => void;
  onCopy: (code: string) => void;
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
        const basePath = window.location.origin;
        const url = `${basePath}/event/${eventSlug}?${INVITE_CODE_QUERY_PARAM}=${row.original.code}`;

        function copyToClipboard() {
          void navigator.clipboard.writeText(url);
          onCopy(row.original.code);
          toast.success('Enlace copiado al portapapeles');
        }

        return (
          <Button
            type='button'
            variant='ghost'
            className='justify-start gap-2'
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

  const setCodeShared = trpc.organizer.setCodeShared.useMutation({
    onError: (_error, variables) => {
      setSharedByCode((current) => {
        const next = new Map(current);
        next.set(variables.code, !variables.shared);
        return next;
      });
      toast.error('No se pudo actualizar el estado de compartido');
    },
  });

  const setCodeSharedRef = useRef(setCodeShared);
  setCodeSharedRef.current = setCodeShared;

  const handlersRef = useRef({
    onSharedChange: (_code: string, _shared: boolean) => {},
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
    onCopy: (code) => {
      const alreadyShared = sharedByCodeRef.current.get(code) ?? false;
      handlersRef.current.onSharedChange(code, true);
      if (!alreadyShared) {
        setCodeSharedRef.current.mutate({ eventId, code, shared: true });
      }
    },
  };

  const tableData = useMemo(
    () =>
      codes.map((code) => ({
        ...code,
        shared: sharedByCode.get(code.code) ?? code.shared,
      })),
    [codes, sharedByCode],
  );

  const tableColumns = useMemo(
    () =>
      buildColumns({
        eventId,
        eventSlug,
        onSharedChange: (code, shared) =>
          handlersRef.current.onSharedChange(code, shared),
        onCopy: (code) => handlersRef.current.onCopy(code),
      }),
    [eventId, eventSlug],
  );

  return <DataTable columns={tableColumns} data={tableData} />;
}
