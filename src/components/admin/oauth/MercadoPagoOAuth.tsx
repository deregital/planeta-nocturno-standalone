import MercadoPagoConnect from '@/components/admin/oauth/MercadoPagoConnect';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { signPayload } from '@/server/security/signed-request';

function getMercadoPagoAuthUrl(publicUrl: string) {
  if (!process.env.PLUTO_URL) return null;

  const timestamp = Date.now().toString();
  const signature = signPayload(timestamp, publicUrl);
  if (!signature) return null;

  const url = new URL('/oauth/start', process.env.PLUTO_URL);
  url.searchParams.set('instance_url', publicUrl);
  url.searchParams.set('timestamp', timestamp);
  url.searchParams.set('signature', `sha256=${signature}`);
  return url.toString();
}

/** Vinculación de Mercado Pago, dentro de su tarjeta en Medios de pago. */
export default async function MercadoPagoOAuth({
  canUnlink,
}: {
  canUnlink: boolean;
}) {
  const { instance } = await getCurrentRequestContext();
  const isConnected = Boolean(
    instance.mercadoPagoAccessToken && instance.mercadoPagoRefreshToken,
  );
  const authUrl = getMercadoPagoAuthUrl(instance.publicUrl);

  return (
    <div className='flex flex-col items-start gap-3'>
      <p className='text-sm text-muted-foreground'>
        {isConnected
          ? 'Los cobros se acreditan en tu cuenta de Mercado Pago y las entradas se mandan solas.'
          : 'Conectá tu cuenta de Mercado Pago para cobrar con tarjeta, débito o saldo.'}
      </p>
      <MercadoPagoConnect
        isConnected={isConnected}
        authUrl={authUrl}
        canUnlink={canUnlink}
        isMultiTenant={instance.tenantId !== null}
      />
    </div>
  );
}
