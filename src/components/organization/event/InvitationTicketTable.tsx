'use client';

import { type StrictColumnDef } from '@tanstack/react-table';
import { EllipsisVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';
import { INVITE_CODE_QUERY_PARAM } from '@/server/utils/constants';

type InvitationCode = RouterOutputs['organizer']['getMyCodesNotUsed'][number];

// Con el panel abierto, el jefe puede redistribuir y el código pasa a otra persona.
const CODE_NOT_YOURS_MESSAGE =
  'Este código ya no es tuyo (lo redistribuyeron o ya se usó). No lo compartas: actualizamos la lista.';

const MOBILE_PAGE_SIZE = 10;

function isNotFound(error: { data?: { code?: string } | null }) {
  return error.data?.code === 'NOT_FOUND';
}

function CodeActions({
  code,
  onShare,
  onToggleShared,
}: {
  code: InvitationCode;
  onShare: (code: InvitationCode) => void;
  onToggleShared: (code: InvitationCode) => void;
}) {
  return (
    <div className='flex shrink-0 items-center gap-1'>
      <Button
        type='button'
        size='sm'
        variant={code.shared ? 'outline' : 'default'}
        onClick={() => onShare(code)}
      >
        {code.shared ? 'Reenviar' : 'Compartir'}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type='button' size='icon' variant='ghost' aria-label='Más'>
            <EllipsisVertical className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onSelect={() => onToggleShared(code)}>
            {code.shared
              ? 'Marcar como no compartido'
              : 'Marcar como compartido'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ShareDrawer({
  code,
  eventName,
  eventSlug,
  onClose,
  onSaveName,
  onShared,
}: {
  code: InvitationCode | null;
  eventName: string;
  eventSlug: string;
  onClose: () => void;
  onSaveName: (code: InvitationCode, name: string) => void;
  onShared: (code: InvitationCode, copied: boolean) => void;
}) {
  const [name, setName] = useState('');
  // `navigator` sólo existe en el navegador: se lee al abrir, no al renderizar en el servidor.
  const [nativeShare, setNativeShare] = useState(false);

  useEffect(() => {
    setName(code?.sharedWith ?? '');
    setNativeShare(typeof navigator.share === 'function');
  }, [code]);

  function close() {
    if (code) onSaveName(code, name.trim());
    onClose();
  }

  function send() {
    if (!code) return;
    onSaveName(code, name.trim());
    const url = `${window.location.origin}/event/${eventSlug}?${INVITE_CODE_QUERY_PARAM}=${code.code}`;
    // El portapapeles y el menú de compartir exigen el toque: se llaman ya.
    if (nativeShare) {
      navigator
        .share({ text: `Tu invitación para ${eventName}`, url })
        .then(() => {
          onShared(code, false);
          onClose();
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
          toast.error('No se pudo compartir el enlace');
        });
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        onShared(code, true);
        onClose();
      })
      .catch(() => toast.error('No se pudo copiar el enlace'));
  }

  return (
    <Drawer open={code !== null} onOpenChange={(open) => !open && close()}>
      <DrawerContent className='px-4 pb-6'>
        <form
          className='mx-auto flex w-full max-w-sm flex-col gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <DrawerHeader className='px-0'>
            <DrawerTitle>Código #{code?.shortId}</DrawerTitle>
            <DrawerDescription>
              Cada enlace sirve para una sola persona.
            </DrawerDescription>
          </DrawerHeader>
          <Input
            value={name}
            maxLength={200}
            placeholder='¿Para quién es? (opcional)'
            aria-label='Para quién es'
            onChange={(event) => setName(event.target.value)}
          />
          <Button type='submit'>
            {nativeShare ? 'Compartir' : 'Copiar enlace'}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

function buildColumns(
  actions: (code: InvitationCode) => React.ReactNode,
): StrictColumnDef<InvitationCode>[] {
  return [
    {
      id: 'id',
      accessorKey: 'shortId',
      header: '#',
      cell: ({ row }) => row.original.shortId,
      meta: {
        exportValue: (row) => String(row.original.shortId),
        exportHeader: 'ID',
      },
    },
    {
      id: 'sharedWith',
      accessorFn: (row) => row.sharedWith ?? '',
      header: 'Para quién',
      cell: ({ row }) => row.original.sharedWith || '—',
      meta: {
        exportValue: (row) => row.original.sharedWith ?? '',
        exportHeader: 'Compartido con',
      },
    },
    {
      id: 'actions',
      accessorKey: 'shared',
      header: '',
      cell: ({ row }) => actions(row.original),
      meta: {
        exportValue: (row) => (row.original.shared ? 'Sí' : 'No'),
        exportHeader: 'Compartido',
      },
    },
  ];
}

export function InvitationTicketTable({
  codes: initialCodes,
  eventId,
  eventSlug,
  eventName,
}: {
  codes: InvitationCode[];
  eventId: string;
  eventSlug: string;
  eventName: string;
}) {
  const router = useRouter();
  const [codes, setCodes] = useState(initialCodes);
  const [tab, setTab] = useState<'pending' | 'shared'>('pending');
  const [sharing, setSharing] = useState<InvitationCode | null>(null);
  // Hay organizadores con cientos de códigos: en el celular se pagina como en la tabla.
  const [mobilePage, setMobilePage] = useState(0);

  useEffect(() => {
    setCodes(initialCodes);
  }, [initialCodes]);

  function patch(code: string, values: Partial<InvitationCode>) {
    setCodes((current) =>
      current.map((c) => (c.code === code ? { ...c, ...values } : c)),
    );
  }

  const setCodeShared = trpc.organizer.setCodeShared.useMutation({
    onError: (error, variables) => {
      patch(variables.code, { shared: !variables.shared });
      if (isNotFound(error)) {
        toast.error(CODE_NOT_YOURS_MESSAGE);
        router.refresh();
        return;
      }
      toast.error('No se pudo actualizar el estado de compartido');
    },
  });

  const setCodeSharedWith = trpc.organizer.setCodeSharedWith.useMutation({
    onError: () => toast.error('No se pudo guardar para quién es'),
  });

  function setShared(code: InvitationCode, shared: boolean, copied = false) {
    patch(code.code, { shared });
    // Aunque ya estuviera compartido: así se confirma que sigue siendo suyo.
    setCodeShared.mutate(
      { eventId, code: code.code, shared },
      {
        onSuccess: () => {
          if (copied) toast.success('Enlace copiado');
        },
      },
    );
  }

  function saveName(code: InvitationCode, name: string) {
    const previous = code.sharedWith ?? '';
    if (name === previous) return;
    patch(code.code, { sharedWith: name || null });
    setCodeSharedWith.mutate(
      { eventId, code: code.code, sharedWith: name },
      { onError: () => patch(code.code, { sharedWith: previous || null }) },
    );
  }

  const handlersRef = useRef({ setShared, setSharing });
  handlersRef.current = { setShared, setSharing };

  const columns = useMemo(
    () =>
      buildColumns((code) => (
        <CodeActions
          code={code}
          onShare={(c) => handlersRef.current.setSharing(c)}
          onToggleShared={(c) => handlersRef.current.setShared(c, !c.shared)}
        />
      )),
    [],
  );

  const pending = codes.filter((c) => !c.shared);
  const shared = codes.filter((c) => c.shared);
  const visible = tab === 'pending' ? pending : shared;
  const pageCount = Math.max(1, Math.ceil(visible.length / MOBILE_PAGE_SIZE));
  // Al compartir, la lista se achica: la página no puede quedar fuera de rango.
  const page = Math.min(mobilePage, pageCount - 1);
  const pageCodes = visible.slice(
    page * MOBILE_PAGE_SIZE,
    (page + 1) * MOBILE_PAGE_SIZE,
  );
  const emptyMessage =
    tab === 'pending'
      ? 'No te quedan códigos por compartir.'
      : 'Todavía no compartiste ningún código.';

  if (codes.length === 0) {
    return (
      <p className='px-4 text-accent/70'>
        No tenés códigos de invitación para este evento.
      </p>
    );
  }

  return (
    <div className='mx-auto flex w-full max-w-[98%] flex-col gap-3'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-accent'>
          {pending.length > 0
            ? `Te quedan ${pending.length} de ${codes.length} por compartir`
            : `Compartiste tus ${codes.length} códigos`}
        </p>
        {pending.length > 0 && (
          <Button type='button' onClick={() => setSharing(pending[0])}>
            Compartir siguiente
          </Button>
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as 'pending' | 'shared');
          setMobilePage(0);
        }}
      >
        <TabsList className='w-full sm:w-fit'>
          <TabsTrigger value='pending'>
            Pendientes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value='shared'>
            Compartidos ({shared.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Celular: una fila por código. Desde md, la tabla con exportación. */}
      <ul className='divide-y divide-stroke/70 rounded-md border border-stroke/70 bg-white md:hidden'>
        {visible.length === 0 && (
          <li className='p-4 text-center text-accent/70'>{emptyMessage}</li>
        )}
        {pageCodes.map((code) => (
          <li key={code.code} className='flex items-center gap-3 p-3'>
            <div className='min-w-0 flex-1'>
              <p className='font-medium text-accent'>#{code.shortId}</p>
              {code.sharedWith && (
                <p className='truncate text-sm text-accent/70'>
                  {code.sharedWith}
                </p>
              )}
            </div>
            <CodeActions
              code={code}
              onShare={setSharing}
              onToggleShared={(c) => setShared(c, !c.shared)}
            />
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <div className='flex items-center justify-between gap-2 md:hidden'>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            disabled={page === 0}
            onClick={() => setMobilePage(page - 1)}
          >
            Anterior
          </Button>
          <span className='text-sm text-accent/70'>
            {page + 1} de {pageCount}
          </span>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            disabled={page === pageCount - 1}
            onClick={() => setMobilePage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      <div className='hidden md:block'>
        <DataTable
          columns={columns}
          data={visible}
          divClassName='max-w-full'
          noResultsPlaceholder={emptyMessage}
        />
      </div>

      <ShareDrawer
        code={sharing}
        eventName={eventName}
        eventSlug={eventSlug}
        onClose={() => setSharing(null)}
        onSaveName={saveName}
        onShared={(code, copied) => setShared(code, true, copied)}
      />
    </div>
  );
}
