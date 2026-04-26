'use client';

import { type Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

function getStatusLabel(status: RedeployStatus) {
  if (status === 'IN_PROGRESS') return 'Redeploy en progreso...';
  if (status === 'SUCCESS') return 'Redeploy completado con exito';
  if (status === 'FAILED') return 'El redeploy fallo';
  if (status === 'NO_DEPLOYMENTS')
    return 'No hay deployments para este proyecto';
  return 'Estado de redeploy desconocido';
}

export default function CredentialsRedeployStatus({
  nextPath,
}: {
  nextPath: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<RedeployStatus>('IN_PROGRESS');
  const [vercelState, setVercelState] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('Consultando estado...');
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
          setMessage('No se pudo validar el estado del redeploy.');
          setPolling(false);
          return;
        }

        setStatus(data.status);
        if ('vercelState' in data) {
          setVercelState(data.vercelState);
        }

        if (data.status === 'SUCCESS') {
          setMessage('Redirigiendo al panel...');
          setPolling(false);
          router.replace(nextPath as Route);
          return;
        }

        if (data.status === 'FAILED' || data.status === 'UNKNOWN') {
          setMessage(
            'La configuracion no pudo completarse. Revisa e intenta otra vez.',
          );
          setPolling(false);
          return;
        }

        setMessage(getStatusLabel(data.status));
      } catch {
        if (cancelled) return;
        setStatus('UNKNOWN');
        setMessage('Error consultando estado de redeploy.');
        setPolling(false);
      }
    }

    checkStatus();
    if (!polling) {
      return () => {
        cancelled = true;
      };
    }

    const interval = setInterval(checkStatus, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [nextPath, polling, router]);

  return (
    <div className='mt-6 rounded-md border border-stroke bg-muted/20 p-4'>
      <p className='text-sm font-medium text-main'>{getStatusLabel(status)}</p>
      <p className='mt-1 text-sm text-main/80'>{message}</p>
      {vercelState && (
        <p className='mt-2 text-xs text-main/70'>vercelState: {vercelState}</p>
      )}
      {!polling && status !== 'SUCCESS' && (
        <div className='mt-4'>
          <Link href='/credentials' className='text-sm text-blue-600 underline'>
            Volver a configurar credenciales
          </Link>
        </div>
      )}
    </div>
  );
}
