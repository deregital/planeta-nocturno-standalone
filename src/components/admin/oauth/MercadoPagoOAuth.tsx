import MercadoPagoConnect from '@/components/admin/oauth/MercadoPagoConnect';
import { MercadoPago } from '@/components/icons/MercadoPago';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

export default async function MercadoPagoOAuth() {
  const { instance } = await getCurrentRequestContext();
  const isConnected = Boolean(
    instance.mercadoPagoAccessToken && instance.mercadoPagoRefreshToken,
  );
  const authUrl = getMercadoPagoAuthUrl(instance.publicUrl);

  return (
    <Card className='mx-4 bg-accent-ultra-light'>
      <CardHeader className='flex flex-row items-center gap-3'>
        <MercadoPago />
        <div className='flex flex-col gap-1'>
          <CardTitle>Mercado Pago</CardTitle>
          <CardDescription>
            Conectá tu cuenta de Mercado Pago para cobrar tus tickets.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className='flex flex-col items-start gap-3'>
        <MercadoPagoConnect isConnected={isConnected} authUrl={authUrl} />
      </CardContent>
    </Card>
  );
}
