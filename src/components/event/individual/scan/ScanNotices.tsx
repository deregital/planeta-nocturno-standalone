'use client';

import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Aviso de la puerta que no es el resultado de un escaneo (ticket escaneado
 * dos veces, escaneos pendientes que se subieron). Se cierra solo o con "Entendido":
 * no depende de un toast, que en el celular se queda pausado si lo tocan.
 */
export type ScanNotice = {
  id: string;
  tone: 'warn' | 'info';
  title: string;
  body: string;
  dni?: string | null;
  autoHideMs: number;
};

/** Ticket escaneado dos veces o eliminado: hay que leerlo, pero no tapa la puerta. */
export const CONFLICT_NOTICE_MS = 30_000;
export const INFO_NOTICE_MS = 10_000;
/** Los que se ven a la vez; el resto queda en el historial. */
export const MAX_NOTICES = 3;

function NoticeItem({
  notice,
  onDismiss,
}: {
  notice: ScanNotice;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notice.id), notice.autoHideMs);
    return () => clearTimeout(timer);
  }, [notice.id, notice.autoHideMs, onDismiss]);

  const warn = notice.tone === 'warn';
  return (
    <div
      role={warn ? 'alert' : 'status'}
      className={cn(
        'flex flex-col gap-1 rounded-xl border-2 px-3 py-2 text-sm',
        warn
          ? 'border-orange-500 bg-orange-50 text-orange-950'
          : 'border-green-600 bg-green-50 text-green-950',
      )}
    >
      <div className='flex items-start gap-2'>
        {warn ? (
          <TriangleAlert className='mt-0.5 size-5 shrink-0 text-orange-600' />
        ) : (
          <CircleCheck className='mt-0.5 size-5 shrink-0 text-green-700' />
        )}
        <p className='min-w-0 font-bold break-words'>{notice.title}</p>
      </div>
      {notice.dni && (
        <p>
          <span className='font-bold'>DNI:</span> {notice.dni}
        </p>
      )}
      <p className='break-words'>{notice.body}</p>
      <Button
        variant='ghost'
        size='sm'
        className='self-end font-bold'
        onClick={() => onDismiss(notice.id)}
      >
        Entendido
      </Button>
    </div>
  );
}

export function ScanNotices({
  notices,
  onDismiss,
}: {
  notices: ScanNotice[];
  onDismiss: (id: string) => void;
}) {
  if (notices.length === 0) return null;
  return (
    <div className='flex flex-col gap-2'>
      {notices.map((notice) => (
        <NoticeItem key={notice.id} notice={notice} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
