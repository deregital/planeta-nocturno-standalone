'use client';

import { Settings2 } from 'lucide-react';
import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  deviceCode,
  type DeviceModePreference,
} from '@/components/event/individual/scan/local/device';
import { type ScanController } from '@/components/event/individual/scan/useScanController';
import { type ScannerMode } from '@/lib/scan/protocol';
import {
  classifyRequestError,
  isUnexpectedScanError,
  requestErrorMessage,
} from '@/lib/scan/scan-errors';
import { cn } from '@/lib/utils';
import { trpc } from '@/server/trpc/client';

const EVENT_MODES: { value: ScannerMode; label: string; hint: string }[] = [
  {
    value: 'off',
    label: 'Normal',
    hint: 'Cada escaneo espera al servidor (como siempre).',
  },
  {
    value: 'shadow',
    label: 'Sombra',
    hint: 'Igual que normal, pero el celular calcula su decisión y se registra si coincide.',
  },
  {
    value: 'local',
    label: 'Rápido',
    hint: 'El celular decide al instante los tickets que conoce y confirma por detrás.',
  },
];

const DEVICE_MODES: { value: DeviceModePreference; label: string }[] = [
  { value: 'auto', label: 'Lo del evento' },
  { value: 'shadow', label: 'Sombra' },
  { value: 'off', label: 'Normal' },
];

const MAX_STALE_OPTIONS = [30, 60, 120, 300];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className='grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-accent-ultra-light p-1'>
      {options.map((option) => (
        <button
          key={option.value}
          type='button'
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-lg px-2 py-2 text-sm font-medium transition-colors disabled:opacity-50',
            value === option.value
              ? 'bg-accent text-on-accent'
              : 'text-accent-dark hover:bg-accent/10',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Opciones avanzadas del escáner: el modo de cada evento (quien puede editar
 * eventos) y los límites de este celular, que solo pueden ser más
 * conservadores que los del evento.
 */
export function ScannerSettings({
  controller,
}: {
  controller: ScanController;
}) {
  const { config, prefs, setPrefs, status, deviceId } = controller;
  const setConfig = trpc.scanner.setConfig.useMutation({
    onSuccess: () => {
      void controller.refetchConfig();
    },
    onError: (error) => {
      toast.error(
        requestErrorMessage(error, {
          online: navigator.onLine,
          action: 'cambiar el modo',
        }),
      );
      if (
        isUnexpectedScanError(
          classifyRequestError(error, { online: navigator.onLine }).code,
        )
      ) {
        posthog.captureException(error, {
          scanner_error_code: 'SET_CONFIG_FAILED',
        });
      }
    },
  });
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  if (!config?.available) return null;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant='ghost'
          className='bg-accent/25'
          aria-label='Opciones del escáner'
        >
          <Settings2 className='size-6 text-white' />
        </Button>
      </DrawerTrigger>
      <DrawerContent className='px-4 pb-6'>
        <DrawerHeader className='px-0'>
          <DrawerTitle>Escaneo rápido (beta)</DrawerTitle>
          <DrawerDescription>
            En modo rápido el celular decide al instante y confirma con el
            servidor por detrás. Si pasa más de N segundos sin sincronizar,
            vuelve solo al modo normal.
          </DrawerDescription>
        </DrawerHeader>

        <div className='flex flex-col gap-6 overflow-y-auto max-h-[60vh]'>
          <section className='flex flex-col gap-3'>
            <h3 className='font-semibold text-accent-dark'>
              {config.events.length > 1 ? 'Eventos' : 'Este evento'}
            </h3>
            {config.events.map((event) => (
              <div key={event.eventId} className='flex flex-col gap-2'>
                {config.events.length > 1 && (
                  <p className='text-sm font-medium text-accent-dark'>
                    {event.name}
                  </p>
                )}
                <Segmented
                  options={EVENT_MODES}
                  value={event.mode}
                  disabled={!config.canEdit || setConfig.isPending}
                  onChange={(mode) =>
                    setConfig.mutate({
                      eventId: event.eventId,
                      mode,
                      maxStaleSeconds: event.maxStaleSeconds,
                    })
                  }
                />
                <p className='text-xs text-accent-dark/70'>
                  {EVENT_MODES.find((m) => m.value === event.mode)?.hint}
                </p>
                {event.mode === 'local' && (
                  <label className='flex items-center justify-between gap-2 text-sm text-accent-dark'>
                    Máximo sin sincronizar (N)
                    <select
                      className='rounded-lg border border-stroke bg-white px-2 py-1'
                      value={event.maxStaleSeconds}
                      disabled={!config.canEdit || setConfig.isPending}
                      onChange={(e) =>
                        setConfig.mutate({
                          eventId: event.eventId,
                          mode: event.mode,
                          maxStaleSeconds: Number(e.target.value),
                        })
                      }
                    >
                      {[
                        ...new Set([
                          ...MAX_STALE_OPTIONS,
                          event.maxStaleSeconds,
                        ]),
                      ]
                        .sort((a, b) => a - b)
                        .map((seconds) => (
                          <option key={seconds} value={seconds}>
                            {seconds} s
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </div>
            ))}
            {!config.canEdit && (
              <p className='text-xs text-accent-dark/70'>
                Solo quien puede editar eventos cambia el modo del evento.
              </p>
            )}
          </section>

          <section className='flex flex-col gap-3'>
            <h3 className='font-semibold text-accent-dark'>Este celular</h3>
            <Segmented
              options={DEVICE_MODES}
              value={prefs.mode}
              onChange={(mode) => setPrefs({ ...prefs, mode })}
            />
            <label className='flex items-center justify-between gap-2 text-sm text-accent-dark'>
              Tope de N en este celular
              <select
                className='rounded-lg border border-stroke bg-white px-2 py-1'
                value={prefs.maxStaleSeconds ?? ''}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    maxStaleSeconds: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              >
                <option value=''>El del evento</option>
                {MAX_STALE_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} s
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className='rounded-xl bg-accent-ultra-light p-3 text-xs text-accent-dark flex flex-col gap-1'>
            <p>
              Terminal <strong>{deviceId ? deviceCode(deviceId) : '—'}</strong>{' '}
              · modo en uso <strong>{status.mode}</strong> · N{' '}
              <strong>{status.maxStaleSeconds} s</strong>
            </p>
            <p>
              {status.tickets} entradas en la lista · {status.pending}{' '}
              pendientes
              {status.foreignPending > 0 &&
                ` · ${status.foreignPending} de otro evento`}
              {status.otherUserPending > 0 &&
                ` · ${status.otherUserPending} de otro usuario sin subir`}
            </p>
            <p>
              Última sincronización:{' '}
              {status.lastSyncAt
                ? `hace ${Math.round((now - status.lastSyncAt) / 1000)} s`
                : 'todavía no'}
              {status.lastError && ` · último error: ${status.lastError}`}
            </p>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
