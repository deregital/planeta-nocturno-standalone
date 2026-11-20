'use client';

import type { Route } from 'next';
import type {
  WithdrawalPurchase,
  WithdrawalPurchaseList,
} from '@/server/services/withdrawal';

import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { ArrowLeft, CircleCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  confirmWithdrawalAction,
  type ConfirmWithdrawalResult,
} from '@/app/(client)/arrepentimiento/actions';
import { Button } from '@/components/ui/button';
import { SCAN_TIMEZONE } from '@/lib/scan/scan-texts';
import { cn, formatCurrency } from '@/lib/utils';
import {
  WITHDRAWAL_INELIGIBLE_REASONS,
  WITHDRAWAL_PATH,
  withdrawalRefundChannel,
} from '@/lib/withdrawal';

function formatDate(value: string, pattern: string) {
  return formatInTimeZone(new Date(value), SCAN_TIMEZONE, pattern, {
    locale: es,
  });
}

function ticketsLabel(count: number) {
  return count === 1 ? '1 entrada' : `${count} entradas`;
}

function EventDate({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <p className='text-sm first-letter:uppercase'>
      {formatDate(value, "EEEE d 'de' MMMM, HH:mm 'h'")}
    </p>
  );
}

type DoneResult = Extract<ConfirmWithdrawalResult, { ok: true }>;

export function WithdrawalFlow({
  mail,
  purchases,
  requests,
  contactEmail,
}: {
  mail: string;
  purchases: WithdrawalPurchase[];
  requests: WithdrawalPurchaseList['requests'];
  contactEmail: string | null;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<'choose' | 'confirm'>('choose');
  const [done, setDone] = useState<DoneResult | null>(null);
  const [error, setError] = useState<{
    message: string;
    linkExpired?: boolean;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = purchases.find(
    (purchase) =>
      purchase.ticketGroupId === selectedId && !purchase.ineligibleReason,
  );

  if (done) {
    return (
      <section className='flex flex-col items-center gap-4 text-center'>
        <CircleCheck className='size-12 text-accent' aria-hidden />
        <h1 className='text-3xl font-bold'>Listo</h1>
        <div>
          <p className='text-sm text-accent-dark/70'>Tu número de trámite</p>
          <p className='text-3xl font-bold tabular-nums'>{done.number}</p>
        </div>
        <p>
          Las entradas quedaron anuladas. Te mandamos el comprobante a{' '}
          <strong className='break-all'>{done.mail}</strong>.
        </p>
        <p>
          Te vamos a devolver <strong>{formatCurrency(done.amount)}</strong>{' '}
          {done.refundChannel}.
        </p>
        <Button asChild variant='accent' className='w-full'>
          <Link href='/'>Volver al inicio</Link>
        </Button>
        {purchases.some(
          (purchase) =>
            !purchase.ineligibleReason && purchase.ticketGroupId !== selectedId,
        ) && (
          <Button
            variant='ghost'
            onClick={() => {
              setDone(null);
              setSelectedId(null);
              setStep('choose');
              router.refresh();
            }}
          >
            Arrepentirme de otra compra
          </Button>
        )}
      </section>
    );
  }

  if (step === 'confirm' && selected) {
    const ticketsSubtotal = selected.amount - selected.serviceFeeAmount;
    return (
      <section className='flex flex-col gap-5'>
        <Button
          variant='ghost'
          className='self-start px-2'
          onClick={() => {
            setError(null);
            setStep('choose');
          }}
          disabled={pending}
        >
          <ArrowLeft />
          Volver
        </Button>
        <h1 className='text-3xl font-bold'>Confirmá el arrepentimiento</h1>

        <div className='flex flex-col gap-4 rounded-lg border border-stroke p-4'>
          <div className='min-w-0'>
            <p className='text-xs text-accent-dark/70'>Evento</p>
            <p className='font-semibold break-words'>{selected.eventName}</p>
            <EventDate value={selected.eventStartingDate} />
          </div>
          <div>
            <p className='text-xs text-accent-dark/70'>Entradas</p>
            <ul className='text-sm'>
              {selected.tickets.map((ticket) => (
                <li key={ticket.typeName} className='break-words'>
                  {ticket.amount} × {ticket.typeName}
                </li>
              ))}
            </ul>
          </div>
          <dl className='flex flex-col gap-1 border-t border-stroke pt-3 text-sm'>
            {selected.serviceFeeAmount > 0 && (
              <>
                <div className='flex justify-between gap-3'>
                  <dt>Entradas</dt>
                  <dd className='tabular-nums'>
                    {formatCurrency(ticketsSubtotal)}
                  </dd>
                </div>
                <div className='flex justify-between gap-3'>
                  <dt>Cargo por servicio</dt>
                  <dd className='tabular-nums'>
                    {formatCurrency(selected.serviceFeeAmount)}
                  </dd>
                </div>
              </>
            )}
            <div className='flex justify-between gap-3 text-base font-bold'>
              <dt>Total a devolver</dt>
              <dd className='tabular-nums'>
                {formatCurrency(selected.amount)}
              </dd>
            </div>
          </dl>
        </div>

        <p
          role='note'
          className='flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900'
        >
          <TriangleAlert className='mt-0.5 size-4 shrink-0' aria-hidden />
          <span>
            {selected.ticketCount === 1
              ? 'La entrada se anula en el momento y ya no sirve para entrar.'
              : `Las ${selected.ticketCount} entradas se anulan en el momento y ya no sirven para entrar.`}
          </span>
        </p>
        <p className='text-sm text-accent-dark/70'>
          El dinero vuelve {withdrawalRefundChannel(selected.paymentMethod)}.
        </p>

        {error && (
          <div
            role='alert'
            className='flex flex-col gap-2 text-sm text-red-500'
          >
            <p>{error.message}</p>
            {error.linkExpired && (
              <Link
                href={WITHDRAWAL_PATH as Route}
                className='font-medium underline'
              >
                Pedir un link nuevo
              </Link>
            )}
          </div>
        )}

        <Button
          variant='accent'
          className='w-full'
          loading={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await confirmWithdrawalAction(
                selected.ticketGroupId,
              );
              if (result.ok) {
                setDone(result);
              } else {
                setError({
                  message: result.error,
                  linkExpired: result.linkExpired,
                });
              }
            });
          }}
        >
          Arrepentirme de la compra
        </Button>
      </section>
    );
  }

  const hasEligible = purchases.some((purchase) => !purchase.ineligibleReason);

  return (
    <section className='flex flex-col gap-5'>
      <header className='flex flex-col gap-1'>
        <h1 className='text-3xl font-bold'>Elegí la compra</h1>
        <p className='text-sm text-accent-dark/70 break-all'>
          Compras de {mail}
        </p>
      </header>

      {purchases.length > 0 ? (
        <fieldset className='flex min-w-0 flex-col gap-3'>
          <legend className='sr-only'>Compras</legend>
          {purchases.map((purchase) =>
            purchase.ineligibleReason ? (
              <div
                key={purchase.ticketGroupId}
                className='flex flex-col gap-1 rounded-lg border border-dashed border-stroke bg-accent-dark/5 p-4 text-accent-dark/60'
              >
                <p className='font-semibold break-words'>
                  {purchase.eventName}
                </p>
                <EventDate value={purchase.eventStartingDate} />
                <p className='text-sm'>
                  {ticketsLabel(purchase.ticketCount)} ·{' '}
                  {formatCurrency(purchase.amount)}
                </p>
                <p className='text-sm font-medium text-accent-dark/80'>
                  {WITHDRAWAL_INELIGIBLE_REASONS[purchase.ineligibleReason]}
                </p>
              </div>
            ) : (
              <label
                key={purchase.ticketGroupId}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border border-stroke p-4 transition-colors',
                  'has-[:checked]:border-accent has-[:checked]:bg-accent-ultra-light',
                )}
              >
                <input
                  type='radio'
                  name='purchase'
                  value={purchase.ticketGroupId}
                  checked={selectedId === purchase.ticketGroupId}
                  onChange={() => setSelectedId(purchase.ticketGroupId)}
                  className='mt-1 size-4 shrink-0 accent-accent'
                />
                <span className='flex min-w-0 flex-col gap-1'>
                  <span className='font-semibold break-words'>
                    {purchase.eventName}
                  </span>
                  <EventDate value={purchase.eventStartingDate} />
                  <span className='text-sm'>
                    {ticketsLabel(purchase.ticketCount)} ·{' '}
                    {formatCurrency(purchase.amount)}
                  </span>
                  <span className='text-xs text-accent-dark/70'>
                    Podés arrepentirte hasta el{' '}
                    {formatDate(purchase.deadline, "d 'de' MMMM, HH:mm 'h'")}
                  </span>
                </span>
              </label>
            ),
          )}
        </fieldset>
      ) : (
        <p>No encontramos compras para arrepentirte.</p>
      )}

      {requests.length > 0 && (
        <div className='flex flex-col gap-2'>
          <h2 className='text-sm font-semibold'>Ya pediste</h2>
          <ul className='flex flex-col gap-2'>
            {requests.map((request) => (
              <li
                key={request.number}
                className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-stroke px-4 py-3 text-sm'
              >
                <span className='min-w-0 break-words font-medium'>
                  {request.eventName}
                </span>
                <span className='tabular-nums text-accent-dark/70'>
                  {request.number} ·{' '}
                  {request.status === 'REFUNDED'
                    ? 'Reintegrado'
                    : 'Por reintegrar'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasEligible ? (
        <Button
          variant='accent'
          className='w-full'
          disabled={!selected}
          onClick={() => setStep('confirm')}
        >
          Continuar
        </Button>
      ) : (
        purchases.length > 0 && (
          <p className='text-sm'>
            Ninguna de estas compras se puede arrepentir.
            {contactEmail && (
              <>
                {' '}
                Si tenés dudas, escribí a{' '}
                <a
                  href={`mailto:${contactEmail}`}
                  className='font-medium underline break-all'
                >
                  {contactEmail}
                </a>
                .
              </>
            )}
          </p>
        )
      )}
    </section>
  );
}
