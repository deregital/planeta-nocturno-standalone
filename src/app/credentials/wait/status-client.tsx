'use client';

import { type Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import DotsLoader from '@/components/icons/DotsLoader';

type RedeployStatus =
  | 'IN_PROGRESS'
  | 'SUCCESS'
  | 'FAILED'
  | 'UNKNOWN'
  | 'NO_DEPLOYMENTS';

type StatusResponse =
  | {
      success: true;
      hasDeployments: false;
      isRedeploying: false;
      redeploySuccess: false;
      status: 'NO_DEPLOYMENTS';
    }
  | {
      success: true;
      hasDeployments: true;
      isRedeploying: boolean;
      redeploySuccess: boolean;
      status: 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';
      vercelState: string;
    }
  | {
      success: false;
      message?: string;
    };

const STATUS_POLL_MS = 10_000;

function getStatusLabel(status: RedeployStatus) {
  if (status === 'IN_PROGRESS')
    return 'Estamos aplicando la configuración de Mercado Pago';
  if (status === 'SUCCESS') return 'Listo, ya podés usar la plataforma';
  if (status === 'FAILED') return 'No pudimos completar la activación';
  if (status === 'NO_DEPLOYMENTS')
    return 'No encontramos una actualización en curso';
  return 'No pudimos confirmar el estado por ahora';
}

export default function CredentialsRedeployStatus({
  nextPath,
}: {
  nextPath: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<RedeployStatus>('IN_PROGRESS');
  const [message, setMessage] = useState<string>(
    'Esto puede tardar un minuto. Podés dejar esta ventana abierta.',
  );
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const response = await fetch('/api/credentials/status', {
          method: 'GET',
          cache: 'no-store',
        });
        const data = (await response.json()) as StatusResponse;

        if (cancelled) return;

        if (!response.ok || !data.success) {
          setStatus('UNKNOWN');
          setMessage(
            'No pudimos comprobar si ya terminó el proceso. Revisá tu conexión a internet o esperá un momento y recargá la página.',
          );
          setPolling(false);
          return;
        }

        setStatus(data.status);

        if (data.status === 'SUCCESS') {
          setMessage('Te llevamos al inicio de la plataforma…');
          setPolling(false);
          router.replace(nextPath as Route);
          return;
        }

        if (data.status === 'FAILED' || data.status === 'UNKNOWN') {
          setMessage(
            'Algo salió mal al activar los pagos. Volvé a cargar los datos de Mercado Pago o pedí ayuda a quien administra el sistema.',
          );
          setPolling(false);
          return;
        }

        if (data.status === 'NO_DEPLOYMENTS') {
          setMessage(
            'Si pasan varios minutos y no avanza, contactá al administrador para que revise la configuración.',
          );
        } else {
          setMessage(
            'No hace falta que hagas nada: esta pantalla se actualiza sola cuando termine.',
          );
        }
      } catch {
        if (cancelled) return;
        setStatus('UNKNOWN');
        setMessage(
          'Hubo un problema de conexión. Revisá tu red o recargá la página en unos segundos.',
        );
        setPolling(false);
      }
    }

    checkStatus();
    if (!polling) {
      return () => {
        cancelled = true;
      };
    }

    const interval = setInterval(checkStatus, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [nextPath, polling, router]);

  return (
    <div className='mt-6 rounded-lg border border-stroke/60 bg-muted/30 p-5 sm:p-6 flex flex-col items-center'>
      <div
        className='mb-3 flex h-10 items-center justify-center rounded-full bg-main/10 text-main'
        aria-hidden
      >
        {polling && status === 'IN_PROGRESS' ? (
          <DotsLoader className='size-6' />
        ) : (
          <span className='text-lg font-semibold leading-none' aria-hidden>
            {status === 'SUCCESS' ? '✓' : '!'}
          </span>
        )}
      </div>
      <p className='text-base text-center font-semibold text-main'>
        {getStatusLabel(status)}
      </p>
      <p className='mt-2 text-sm leading-relaxed text-main/80'>{message}</p>
      {!polling && status !== 'SUCCESS' && (
        <div className='mt-5'>
          <Link
            href='/credentials'
            className='inline-flex text-sm font-medium text-main underline decoration-main/40 underline-offset-2 hover:decoration-main'
          >
            Volver a cargar los datos de Mercado Pago
          </Link>
        </div>
      )}
    </div>
  );
}
