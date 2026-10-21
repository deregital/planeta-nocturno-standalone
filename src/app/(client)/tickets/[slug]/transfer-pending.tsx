'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import GoBack from '@/components/common/GoBack';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

function CopyableValue({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between gap-2 rounded-md border border-stroke px-3 py-2 text-left'>
      <div className='min-w-0'>
        <p className='text-xs text-muted-foreground'>{label}</p>
        <p className='font-semibold break-all'>{value}</p>
      </div>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        aria-label={`Copiar ${label.toLowerCase()}`}
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success(`${label} copiado`);
        }}
      >
        <Copy className='size-4' />
      </Button>
    </div>
  );
}

export default function TicketsTransferPending({
  eventName,
  buyerName,
  totalAmount,
  transferAlias,
  contactEmail,
}: {
  eventName: string;
  buyerName: string;
  totalAmount: number;
  transferAlias: string;
  contactEmail: string | null;
}) {
  return (
    <div className='flex justify-center items-center h-full'>
      <GoBack
        route='/'
        title='Volver al inicio'
        className='absolute top-24 md:left-26 left-4'
      />
      <Card className='w-full max-w-md mx-auto text-center shadow-lg m-4'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold'>
            Completá el pago por transferencia
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <p className='text-muted-foreground'>
            Tu reserva para {eventName} quedó registrada. Transferí el total de
            la compra para recibir tus entradas.
          </p>
          <CopyableValue label='Alias / CBU' value={transferAlias} />
          <CopyableValue label='Monto' value={formatCurrency(totalAmount)} />
          <p className='text-sm text-muted-foreground'>
            {contactEmail ? (
              <>
                Enviá el comprobante a{' '}
                <a
                  href={`mailto:${contactEmail}`}
                  className='font-semibold underline'
                >
                  {contactEmail}
                </a>
                .
              </>
            ) : (
              'Enviá el comprobante a los organizadores del evento.'
            )}{' '}
            {buyerName && (
              <>
                Si la cuenta desde la que transferís está a otro nombre, indicá
                en ese mail el nombre que cargaste en la compra: {buyerName}.
              </>
            )}{' '}
            Cuando confirmen el pago, te vamos a enviar las entradas por mail.
            También te enviamos estas instrucciones a tu mail.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
