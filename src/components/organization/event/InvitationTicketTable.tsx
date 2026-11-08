'use client';

import { type StrictColumnDef } from '@tanstack/react-table';
import { Loader2, ShareIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';
import { INVITE_CODE_QUERY_PARAM } from '@/server/utils/constants';

type InvitationCode = RouterOutputs['organizer']['getMyCodesNotUsed'][number];

// Con el panel abierto, el jefe puede redistribuir y el código pasa a otra persona.
const CODE_NOT_YOURS_MESSAGE =
  'Este código ya no es tuyo (lo redistribuyeron o ya se usó). No lo compartas: actualizamos la lista.';

function isNotFound(error: { data?: { code?: string } | null }) {
  return error.data?.code === 'NOT_FOUND';
}

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
  const router = useRouter();
  const setCodeShared = trpc.organizer.setCodeShared.useMutation({
    onError: (error, variables) => {
      onSharedChange(variables.code, !variables.shared);
      if (isNotFound(error)) {
        toast.error(CODE_NOT_YOURS_MESSAGE);
        router.refresh();
        return;
      }
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

function buildColumns({
  eventId,
  eventSlug,
  onSharedChange,
  onCopy,
  sharingCode,
}: {
  eventId: string;
  eventSlug: string;
  onSharedChange: (code: string, shared: boolean) => void;
  onCopy: (code: string) => void;
  sharingCode: string | null;
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
          // Se copia ya (el portapapeles exige el toque), pero el "copiado"
          // recién sale cuando el servidor confirma que el código sigue siendo suyo.
          navigator.clipboard
            .writeText(url)
            .then(() => onCopy(row.original.code))
            .catch(() => toast.error('No se pudo copiar el enlace'));
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

  const router = useRouter();
  const [sharingCode, setSharingCode] = useState<string | null>(null);
  const setCodeShared = trpc.organizer.setCodeShared.useMutation({
    onError: (error, variables) => {
      setSharedByCode((current) => {
        const next = new Map(current);
        next.set(variables.code, !variables.shared);
        return next;
      });
      if (isNotFound(error)) {
        toast.error(CODE_NOT_YOURS_MESSAGE);
        router.refresh();
        return;
      }
      toast.error('No se pudo actualizar el estado de compartido');
    },
    onSettled: () => setSharingCode(null),
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
      handlersRef.current.onSharedChange(code, true);
      // Aunque ya estuviera compartido: así se confirma que sigue siendo suyo.
      setSharingCode(code);
      setCodeSharedRef.current.mutate(
        { eventId, code, shared: true },
        { onSuccess: () => toast.success('Enlace copiado al portapapeles') },
      );
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
        sharingCode,
      }),
    [eventId, eventSlug, sharingCode],
  );

  return <DataTable columns={tableColumns} data={tableData} />;
}
