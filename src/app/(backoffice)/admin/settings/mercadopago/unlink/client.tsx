'use client';

import { AlertTriangle } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { clearMercadoPagoStatusCookie } from '@/components/admin/oauth/MercadoPagoConnect';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { trpc } from '@/server/trpc/client';

type UnlinkMercadoPagoClientProps = {
  token: string | null;
  isConnected: boolean;
  transferAlias: string | null;
};

export default function UnlinkMercadoPagoClient({
  token,
  isConnected,
  transferAlias,
}: UnlinkMercadoPagoClientProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const confirmUnlink = trpc.mercadoPago.confirmUnlink.useMutation({
    onSuccess(data) {
      clearMercadoPagoStatusCookie();
      utils.mercadoPago.hasCredentials.invalidate();
      const href = (
        data.pending
          ? '/admin/settings?mp=unlinked-pending'
          : '/admin/settings?mp=unlinked'
      ) as Route;
      router.replace(href);
      router.refresh();
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  if (!token) {
    return (
      <UnlinkCard
        title={
          isConnected
            ? 'El link no es válido'
            : 'Mercado Pago no está vinculado'
        }
        description={
          isConnected
            ? 'El link no es válido, ya se usó o venció. Podés pedir uno nuevo desde Configuración.'
            : 'Mercado Pago no está vinculado a la plataforma.'
        }
        footer={
          <Button asChild className='h-10 w-full'>
            <Link href='/admin/settings'>Volver a Configuración</Link>
          </Button>
        }
      />
    );
  }

  return (
    <UnlinkCard
      title='Desvincular Mercado Pago'
      footer={
        <div className='flex w-full flex-col gap-2'>
          <Button
            variant='destructive'
            className='h-10 w-full'
            disabled={confirmUnlink.isPending}
            onClick={() => confirmUnlink.mutate({ token })}
          >
            {confirmUnlink.isPending
              ? 'Desvinculando...'
              : 'Confirmar desvinculación'}
          </Button>
          <Button asChild variant='ghost' className='h-10 w-full'>
            <Link href='/admin/settings'>Cancelar</Link>
          </Button>
        </div>
      }
    >
      <Alert variant='destructive' className='text-left'>
        <AlertTriangle />
        <AlertTitle>Esta acción no se puede deshacer</AlertTitle>
        <AlertDescription>
          {transferAlias
            ? `Las entradas pagas pasan a cobrarse por transferencia al alias ${transferAlias}. El comprador manda el comprobante a tu mail de contacto y liberás las entradas desde la página del evento.`
            : 'No se van a poder cobrar entradas online ni crear tickets pagos hasta que vuelvas a conectar una cuenta.'}
        </AlertDescription>
      </Alert>
    </UnlinkCard>
  );
}

function UnlinkCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className='flex h-main-screen items-center justify-center'>
      <Card className='m-4 w-full max-w-md text-center shadow-lg'>
        <CardHeader>
          <CardTitle className='flex items-center justify-center gap-2 text-2xl font-bold text-accent'>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {description ? (
            <p className='text-muted-foreground'>{description}</p>
          ) : (
            children
          )}
        </CardContent>
        <CardFooter>{footer}</CardFooter>
      </Card>
    </div>
  );
}
