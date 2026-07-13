import MercadoPagoConnect from '@/components/admin/oauth/MercadoPagoConnect';
import { MercadoPago } from '@/components/icons/MercadoPago';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function getMercadoPagoAuthUrl() {
  const { MP_CLIENT_ID, PLUTO_URL, INSTANCE_WEB_URL } = process.env;

  if (!MP_CLIENT_ID || !PLUTO_URL || !INSTANCE_WEB_URL) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: MP_CLIENT_ID,
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: `${PLUTO_URL}/oauth`,
    state: INSTANCE_WEB_URL,
  });

  return `https://auth.mercadopago.com/authorization?${params.toString()}`;
}

export default function MercadoPagoOAuth() {
  const isConnected = Boolean(
    process.env.MP_ACCESS_TOKEN &&
      process.env.MP_SECRET_KEY &&
      process.env.MP_REFRESH_TOKEN,
  );
  const authUrl = getMercadoPagoAuthUrl();

  return (
    <Card className='mx-4 bg-accent-ultra-light'>
      <CardHeader className='flex flex-row items-center gap-3'>
        <MercadoPago />
        <div className='flex flex-col gap-1'>
          <CardTitle>Mercado Pago</CardTitle>
          <CardDescription>
            Conectá tu cuenta de Mercado Pago para cobrar las entradas.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className='flex flex-col items-start gap-3'>
        <MercadoPagoConnect isConnected={isConnected} authUrl={authUrl} />
      </CardContent>
    </Card>
  );
}
