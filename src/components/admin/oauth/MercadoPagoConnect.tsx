'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import MercadoPagoUnlinkDialog from '@/components/admin/oauth/MercadoPagoUnlinkDialog';
import {
  TransferAliasField,
  TransferAliasForm,
  validateTransferAlias,
} from '@/components/admin/oauth/TransferAliasField';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { trpc } from '@/server/trpc/client';

const MP_STATUS_COOKIE = 'mp_oauth_status';
const MP_TEST_EVENT_PROMPT_KEY = 'mp_test_event_prompt_shown';

type MercadoPagoConnectProps = {
  isConnected: boolean;
  authUrl: string | null;
  canUnlink: boolean;
  isMultiTenant: boolean;
};

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setStatusCookie(value: string) {
  document.cookie = `${MP_STATUS_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=300; SameSite=Lax`;
}

export function clearMercadoPagoStatusCookie() {
  document.cookie = `${MP_STATUS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export default function MercadoPagoConnect({
  isConnected,
  authUrl,
  canUnlink,
  isMultiTenant,
}: MercadoPagoConnectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get('mp');
  const refreshedStatus = useRef(false);
  const [cookieStatus, setCookieStatus] = useState<string | null>(null);
  const [testEventModalOpen, setTestEventModalOpen] = useState(false);

  useEffect(() => {
    if (isMultiTenant) {
      clearMercadoPagoStatusCookie();
      return;
    }

    if (urlStatus === 'unlinked' || urlStatus === 'unlinked-pending') {
      clearMercadoPagoStatusCookie();
      setCookieStatus(null);
      return;
    }

    if (urlStatus === 'success') {
      setStatusCookie('success');
      setCookieStatus('success');
      return;
    }

    setCookieStatus(getCookie(MP_STATUS_COOKIE));
  }, [isMultiTenant, urlStatus]);

  const status =
    urlStatus === 'error'
      ? 'error'
      : urlStatus === 'unlinked' || urlStatus === 'unlinked-pending'
        ? urlStatus
        : urlStatus === 'success' ||
            (!isMultiTenant && cookieStatus === 'success')
          ? 'success'
          : null;

  const reportedDisconnected =
    status === 'unlinked' || status === 'unlinked-pending';
  // En multi-tenant las credenciales están en la base. La cookie solo sirve en
  // single-tenant, donde el proceso sigue sin ellas hasta el próximo deploy.
  const connected =
    !reportedDisconnected &&
    (isConnected || (!isMultiTenant && status === 'success'));

  useEffect(() => {
    if (
      urlStatus !== 'success' &&
      urlStatus !== 'unlinked' &&
      urlStatus !== 'unlinked-pending'
    ) {
      return;
    }

    document.getElementById('mercadopago')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    // La página de configuración no lee el query param, así que Next reutiliza
    // el render anterior y sigue mostrando la cuenta como vinculada.
    if (refreshedStatus.current) return;
    refreshedStatus.current = true;
    router.refresh();
  }, [urlStatus, router]);

  useEffect(() => {
    if (!connected || status !== 'success') return;
    if (sessionStorage.getItem(MP_TEST_EVENT_PROMPT_KEY)) return;

    setTestEventModalOpen(true);
    sessionStorage.setItem(MP_TEST_EVENT_PROMPT_KEY, '1');
  }, [connected, status]);

  function dismissTestEventModal() {
    setTestEventModalOpen(false);
  }

  const { data: savedTransferAlias } =
    trpc.mercadoPago.getTransferAlias.useQuery(undefined, {
      enabled: !connected,
    });
  const [transferAlias, setTransferAlias] = useState('');
  const [transferAliasError, setTransferAliasError] = useState<string | null>(
    null,
  );
  const updateTransferAlias = trpc.mercadoPago.updateTransferAlias.useMutation({
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    setTransferAlias(savedTransferAlias ?? '');
  }, [savedTransferAlias]);

  function handleConnectClick(event: React.MouseEvent<HTMLAnchorElement>) {
    const error = validateTransferAlias(transferAlias, false);
    if (error) {
      event.preventDefault();
      setTransferAliasError(error);
      return;
    }

    const value = transferAlias.trim();
    if (value && value !== (savedTransferAlias ?? '')) {
      updateTransferAlias.mutate({ transferAlias: value });
    }
  }

  return (
    <>
      {connected && status === 'success' && (
        <p className='text-sm font-medium text-green-600'>
          Mercado Pago se conectó correctamente.
        </p>
      )}
      {status === 'error' && (
        <p className='text-sm font-medium text-red-500'>
          Ocurrió un error al conectar con Mercado Pago. Intentá nuevamente.
        </p>
      )}
      {status === 'unlinked' && (
        <p className='text-sm font-medium text-green-600'>
          Mercado Pago se desvinculó.
          {savedTransferAlias
            ? ` Las entradas pagas se cobran por transferencia al alias ${savedTransferAlias}. Liberálas desde la página del evento cuando recibas el comprobante.`
            : savedTransferAlias === null
              ? ' Volvé a conectarlo para cobrar entradas online.'
              : null}
        </p>
      )}
      {status === 'unlinked-pending' && (
        <p className='text-sm font-medium text-green-600'>
          La desvinculación de Mercado Pago está en proceso y puede tardar unos
          minutos en completarse.
          {savedTransferAlias
            ? ` Después, las entradas pagas se cobran por transferencia al alias ${savedTransferAlias}.`
            : null}
        </p>
      )}

      <Dialog open={testEventModalOpen} onOpenChange={setTestEventModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cuenta vinculada correctamente</DialogTitle>
            <DialogDescription>
              Te recomendamos crear un evento de prueba y realizar un cobro de
              prueba para confirmar que la cuenta de Mercado Pago asociada es la
              que querés usar para recibir pagos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              onClick={dismissTestEventModal}
            >
              Más tarde
            </Button>
            <Button asChild>
              <Link href='/admin/event/create' onClick={dismissTestEventModal}>
                Crear evento de prueba
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {connected ? (
        <>
          {canUnlink ? (
            <MercadoPagoUnlinkDialog />
          ) : (
            <Button variant='success' disabled>
              Ya estás conectado a Mercado Pago
            </Button>
          )}
          <TransferAliasForm />
        </>
      ) : authUrl ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button>Conectar con Mercado Pago</Button>
          </DialogTrigger>
          <DialogContent className='flex max-w-lg flex-col gap-4'>
            <DialogHeader>
              <DialogTitle>Conectar Mercado Pago</DialogTitle>
            </DialogHeader>
            <p className='text-center text-sm text-gray-500'>
              Al vincular tu cuenta, los cobros de tickets se acreditan en tu
              Mercado Pago. Nosotros no recibimos ni administramos ese dinero:
              la conexión solo permite procesar el pago en tu sitio y confirmar
              las entradas de forma automática cuando se acredita.
            </p>
            <Alert
              className={cn(
                'border-amber-200 bg-amber-50 text-amber-950',
                '[&>svg]:text-amber-600',
              )}
            >
              <AlertTriangle />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription className='text-amber-900/90'>
                La vinculación se realizará con la cuenta de Mercado Pago que
                esté abierta en este dispositivo. Si no es la cuenta que querés
                vincular, cerrá sesión en Mercado Pago antes de continuar.
              </AlertDescription>
            </Alert>
            <TransferAliasField
              id='connect-transfer-alias'
              value={transferAlias}
              onChange={(value) => {
                setTransferAlias(value);
                setTransferAliasError(null);
              }}
              error={transferAliasError}
              description='Opcional. Si Mercado Pago falla al cobrar, los compradores van a ver este alias para transferir el total.'
            />
            <DialogFooter className='sm:justify-end'>
              <a
                href={authUrl}
                target='_blank'
                rel='noopener noreferrer'
                onClick={handleConnectClick}
              >
                <Button className='px-8'>Conectar con Mercado Pago</Button>
              </a>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Button variant='outline' disabled>
          Configuración de Mercado Pago incompleta
        </Button>
      )}
    </>
  );
}
