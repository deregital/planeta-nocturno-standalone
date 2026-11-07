'use client';

import type { RouterOutputs } from '@/server/routers/app';

import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  MapPin,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { ExpandableImage } from '@/components/common/ExpandableImage';
import GoBack from '@/components/common/GoBack';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trpc } from '@/server/trpc/client';

type TicketsPageData =
  RouterOutputs['ticketGroup']['getTicketsForDownloadPage'];
type Ticket = TicketsPageData['tickets'][number];

const TIME_ZONE = 'America/Argentina/Buenos_Aires';

function formatStartingDate(date: string) {
  const day = formatInTimeZone(date, TIME_ZONE, "EEEE d 'de' MMMM yyyy", {
    locale: es,
  });
  const time = formatInTimeZone(date, TIME_ZONE, 'HH:mm');
  return {
    day: day.charAt(0).toUpperCase() + day.slice(1),
    time: `${time} hs`,
  };
}

function formatDni(dni: string) {
  return Number.isNaN(Number(dni)) ? dni : Number(dni).toLocaleString('es-AR');
}

function downloadPdf(pdfBase64: string, fileName: string) {
  const byteCharacters = atob(pdfBase64);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function TicketField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='text-sm font-semibold text-black wrap-break-word sm:text-base'>
        {value}
      </p>
    </div>
  );
}

function TicketCard({
  ticket,
  index,
  total,
  showSlug,
  isDownloading,
  disabled,
  onDownload,
  className,
}: {
  ticket: Ticket;
  index: number;
  total: number;
  showSlug: boolean;
  isDownloading: boolean;
  disabled: boolean;
  onDownload: () => void;
  className?: string;
}) {
  const date = ticket.startingDate
    ? formatStartingDate(ticket.startingDate)
    : null;

  return (
    <article
      aria-label={`Ticket ${index + 1} de ${total}`}
      className={cn(
        'flex flex-col overflow-hidden rounded-3xl border-2 border-stroke bg-white sm:flex-row',
        className,
      )}
    >
      {/* QR: lo primero que se ve */}
      <div className='relative flex flex-col items-center gap-3 bg-accent-ultra-light px-4 pt-4 pb-5 sm:w-80 sm:shrink-0 sm:justify-center sm:py-6'>
        <div className='flex w-full items-center justify-between gap-2'>
          <span className='truncate rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent sm:text-sm'>
            {ticket.ticketTypeName}
          </span>
          {total > 1 && (
            <span className='shrink-0 text-xs font-medium text-muted-foreground'>
              {index + 1} de {total}
            </span>
          )}
        </div>
        <div className='relative rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ticket.qrDataUrl}
            alt={`Código QR del ticket de ${ticket.fullName}`}
            className={cn(
              'size-[min(64vw,38svh,17rem)] sm:size-60 [image-rendering:pixelated]',
              ticket.scanned && 'opacity-20',
            )}
          />
          {ticket.scanned && (
            <span className='absolute inset-0 flex items-center justify-center'>
              <span className='rounded-full bg-black/80 px-3 py-1 text-sm font-semibold text-white'>
                Ya utilizado
              </span>
            </span>
          )}
        </div>
        {/* Perforación del ticket */}
        <span
          aria-hidden
          className='absolute inset-x-4 bottom-0 border-b-2 border-dashed border-stroke sm:inset-x-auto sm:inset-y-4 sm:right-0 sm:bottom-auto sm:border-b-0 sm:border-r-2'
        />
      </div>

      {/* Datos del titular */}
      <div className='flex flex-1 flex-col gap-3 p-4 sm:gap-4 sm:p-6'>
        <div className='grid grid-cols-2 gap-x-4 gap-y-2 sm:gap-y-3'>
          <TicketField
            label='Titular'
            value={ticket.fullName}
            className='col-span-2'
          />
          <TicketField label='DNI' value={formatDni(ticket.dni)} />
          {date && <TicketField label='Ingreso desde' value={date.time} />}
          {date && (
            <TicketField
              label='Fecha'
              value={date.day}
              className='col-span-2'
            />
          )}
          {showSlug && (
            <TicketField
              label='Identificador'
              value={ticket.slug}
              className='col-span-2'
            />
          )}
        </div>

        <div className='mt-auto'>
          <Button
            variant='outline'
            onClick={onDownload}
            disabled={disabled}
            className='w-full'
          >
            {isDownloading ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <Download className='mr-2 h-4 w-4' />
            )}
            {isDownloading ? 'Descargando...' : 'Descargar PDF'}
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function TicketsClient({ data }: { data: TicketsPageData }) {
  const { ticketGroupId, tickets, event, showSlug, contactEmail, purchasedAt } =
    data;
  const utils = trpc.useUtils();
  // 'all' mientras se descargan todos; id del ticket si se descarga uno solo.
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const eventDate = tickets[0]?.startingDate
    ? formatStartingDate(tickets[0].startingDate)
    : null;
  const address = event.location?.address?.trim();
  const coverImageUrl = event.coverImageUrl || '/Foto.png';
  const hasMany = tickets.length > 1;

  function handleCarouselScroll() {
    const el = carouselRef.current;
    if (!el) return;
    const slideWidth = el.scrollWidth / tickets.length;
    setActiveIndex(Math.round(el.scrollLeft / slideWidth));
  }

  function scrollToTicket(index: number) {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({
      left: (el.scrollWidth / tickets.length) * index,
      behavior: 'smooth',
    });
  }

  async function fetchAndDownload(ticket: Ticket, index: number) {
    const result = await utils.ticketGroup.getPdfByEmittedTicketId.fetch({
      ticketGroupId,
      emittedTicketId: ticket.id,
    });
    downloadPdf(result.base64, `ticket-${index + 1}-${ticket.slug}.pdf`);
  }

  async function downloadOne(ticket: Ticket, index: number) {
    setDownloading(ticket.id);
    try {
      await fetchAndDownload(ticket, index);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('No pudimos descargar el ticket. Intentá nuevamente.');
    } finally {
      setDownloading(null);
    }
  }

  async function downloadAll() {
    setDownloading('all');
    try {
      for (let i = 0; i < tickets.length; i++) {
        await fetchAndDownload(tickets[i], i);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('No pudimos descargar los tickets. Intentá nuevamente.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className='flex justify-center px-4 pt-2 pb-10 sm:pt-4'>
      <main className='flex w-full max-w-3xl flex-col gap-4 sm:gap-6'>
        {/* Barra superior compacta */}
        <div className='flex items-center gap-2'>
          <GoBack route='/' aria-label='Volver al inicio' className='px-2' />
          <div className='min-w-0'>
            <h1 className='truncate text-base font-semibold text-black sm:text-xl'>
              {hasMany ? `Tus ${tickets.length} tickets` : 'Tu ticket'}
            </h1>
            <p className='truncate text-xs text-muted-foreground sm:text-sm'>
              {event.name}
            </p>
          </div>
        </div>

        {/* Tickets: en mobile carrusel horizontal para que cada QR quede a la vista */}
        <section className='flex flex-col gap-3'>
          <div
            ref={carouselRef}
            onScroll={hasMany ? handleCarouselScroll : undefined}
            className={cn(
              hasMany &&
                '-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] sm:mx-0 sm:flex-col sm:gap-4 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden',
            )}
          >
            {tickets.map((ticket, index) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                index={index}
                total={tickets.length}
                showSlug={showSlug}
                isDownloading={downloading === ticket.id}
                disabled={downloading !== null}
                onDownload={() => downloadOne(ticket, index)}
                className={cn(
                  hasMany && 'w-[88%] shrink-0 snap-center sm:w-full',
                )}
              />
            ))}
          </div>

          {hasMany && (
            <div className='flex flex-col items-center gap-1 sm:hidden'>
              <div className='flex gap-1.5'>
                {tickets.map((ticket, index) => (
                  <button
                    key={ticket.id}
                    type='button'
                    aria-label={`Ver ticket ${index + 1}`}
                    onClick={() => scrollToTicket(index)}
                    className={cn(
                      'h-2 rounded-full transition-all',
                      index === activeIndex ? 'w-5 bg-accent' : 'w-2 bg-stroke',
                    )}
                  />
                ))}
              </div>
              <p className='text-xs text-muted-foreground'>
                Deslizá para ver los demás tickets
              </p>
            </div>
          )}
        </section>

        {hasMany && (
          <Button
            variant='accent'
            onClick={downloadAll}
            disabled={downloading !== null}
            className='w-full sm:w-auto sm:self-end'
          >
            {downloading === 'all' ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <Download className='mr-2 h-4 w-4' />
            )}
            {downloading === 'all' ? 'Descargando...' : 'Descargar todos'}
          </Button>
        )}

        {/* Info del evento, secundaria */}
        <section className='flex items-start gap-3 rounded-2xl border border-stroke p-3 sm:p-4'>
          <ExpandableImage
            src={coverImageUrl}
            alt={`Portada de ${event.name}`}
            className='relative aspect-square w-14 shrink-0 overflow-hidden rounded-lg border border-stroke/80 sm:w-16'
            sizes='64px'
          />
          <div className='min-w-0 flex-1 space-y-1 text-xs sm:text-sm'>
            <h2 className='font-semibold text-black wrap-break-word'>
              {event.name}
            </h2>
            {eventDate && (
              <p className='flex items-center gap-1.5 text-accent'>
                <CalendarDays className='size-3.5 shrink-0' />
                {eventDate.day} - {eventDate.time}
              </p>
            )}
            {address && (
              <a
                href={event.location?.googleMapsUrl || undefined}
                target='_blank'
                rel='noopener noreferrer'
                className={cn(
                  'flex items-start gap-1.5 text-black',
                  event.location?.googleMapsUrl &&
                    'underline-offset-2 hover:underline',
                )}
              >
                <MapPin className='mt-0.5 size-3.5 shrink-0' />
                <span>
                  {event.location?.name && (
                    <span className='font-semibold'>
                      {event.location.name} ·{' '}
                    </span>
                  )}
                  {address}
                </span>
              </a>
            )}
            {event.minAge ? (
              <p className='text-muted-foreground'>
                Mayores de {event.minAge} años. Llevá tu DNI.
              </p>
            ) : null}
          </div>
        </section>

        <div className='space-y-1 text-center text-xs text-muted-foreground'>
          <p className='flex items-center justify-center gap-1.5'>
            <CheckCircle2 className='size-3.5 shrink-0 text-accent' />
            <span>
              Compra confirmada el{' '}
              {formatInTimeZone(
                purchasedAt,
                TIME_ZONE,
                "d/MM/yyyy 'a las' HH:mm",
              )}{' '}
              hs. También te enviamos los tickets por email.
            </span>
          </p>
          {contactEmail && (
            <p className='flex items-center justify-center gap-1.5'>
              <Mail className='size-3.5 shrink-0' />
              <span>
                ¿Tenés dudas? Escribinos a{' '}
                <a
                  href={`mailto:${contactEmail}`}
                  className='font-semibold text-black underline break-all'
                >
                  {contactEmail}
                </a>
              </span>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
