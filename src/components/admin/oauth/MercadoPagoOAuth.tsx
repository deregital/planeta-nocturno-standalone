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

function getMercadoPagoAuthUrl(publicUrl: string) {
  if (!process.env.PLUTO_URL) {
    return null;
  }

  return `${process.env.PLUTO_URL}/oauth/start?instance_url=${encodeURIComponent(
    publicUrl,
  )}`;
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
