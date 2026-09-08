'use client';

import { type StrictColumnDef } from '@tanstack/react-table';
import { ShareIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { type RouterOutputs } from '@/server/routers/app';
import { INVITE_CODE_QUERY_PARAM } from '@/server/utils/constants';

function columns({
  eventSlug,
  copiedCodes,
  onCopy,
}: {
  eventSlug: string;
  copiedCodes: ReadonlySet<string>;
  onCopy: (code: string) => void;
}): StrictColumnDef<RouterOutputs['organizer']['getMyCodesNotUsed'][number]>[] {
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
          navigator.clipboard.writeText(url);
          onCopy(row.original.code);
          toast.success('URL copiada al portapapeles');
        }
        return (
          <Button
            type='button'
            variant='ghost'
            className='w-56 justify-start gap-2'
            onClick={copyToClipboard}
          >
            {copiedCodes.has(row.original.code)
              ? 'Ya copiado (volver a copiar)'
              : 'Copiar ticket'}
            <ShareIcon className='w-4 h-4 shrink-0' />
          </Button>
        );
      },
    },
  ];
}

export function InvitationTicketTable({
  codes,
  eventSlug,
}: {
  codes: RouterOutputs['organizer']['getMyCodesNotUsed'];
  eventSlug: string;
}) {
  const [copiedCodes, setCopiedCodes] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  function markAsCopied(code: string) {
    setCopiedCodes((currentCodes) => new Set(currentCodes).add(code));
  }

  return (
    <DataTable
      columns={columns({ eventSlug, copiedCodes, onCopy: markAsCopied })}
      data={codes}
    />
  );
}
