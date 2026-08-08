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
  if (!process.env.PLUTO_URL || !process.env.INSTANCE_WEB_URL) {
    return null;
  }

  return `${process.env.PLUTO_URL}/oauth/start?instance_url=${encodeURIComponent(
    process.env.INSTANCE_WEB_URL,
  )}`;
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
