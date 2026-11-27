import type { PaymentMethod } from '@/server/types';

import { Landmark } from 'lucide-react';

import { MercadoPago } from '@/components/icons/MercadoPago';
import { Talo } from '@/components/icons/Talo';
import { cn } from '@/lib/utils';

export type BrandedPaymentMethod = Exclude<PaymentMethod, 'ON_SITE'>;

/**
 * Color e ícono de cada medio de pago. Las clases van escritas enteras para
 * que Tailwind las genere. La transferencia no tiene marca: usa el acento de
 * la plataforma.
 */
export const PAYMENT_BRANDS: Record<
  BrandedPaymentMethod,
  {
    /** Borde de la tarjeta. */
    border: string;
    /** Opción elegida en el checkout. */
    selected: string;
    /** Botón de conectar / configurar. */
    button: string;
  }
> = {
  MERCADO_PAGO: {
    border: 'border-[#009EE3]',
    selected: 'has-[:checked]:border-[#009EE3] has-[:checked]:bg-[#009EE3]/10',
    button: 'bg-[#009EE3] text-white hover:bg-[#009EE3]/90',
  },
  TRANSFER: {
    border: 'border-accent',
    selected: 'has-[:checked]:border-accent has-[:checked]:bg-accent/10',
    button: 'bg-accent text-on-accent hover:bg-accent/90',
  },
  TALO: {
    border: 'border-[#71E150]',
    selected: 'has-[:checked]:border-[#71E150] has-[:checked]:bg-[#71E150]/15',
    button: 'bg-[#71E150] text-[#294617] hover:bg-[#71E150]/90',
  },
};

/** Ícono del medio de pago, del tamaño que diga `className` (p. ej. size-8). */
export function PaymentMethodIcon({
  method,
  className,
}: {
  method: BrandedPaymentMethod;
  className?: string;
}) {
  if (method === 'MERCADO_PAGO') {
    return (
      <span
        className={cn('inline-flex shrink-0 [&>svg]:size-full', className)}
        aria-hidden
      >
        <MercadoPago />
      </span>
    );
  }
  if (method === 'TALO') {
    return <Talo className={cn('shrink-0', className)} />;
  }
  return (
    <Landmark className={cn('shrink-0 text-accent', className)} aria-hidden />
  );
}
