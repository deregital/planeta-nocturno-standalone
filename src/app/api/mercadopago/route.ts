import { mercadoPagoProvider } from '@/server/payments/providers/mercado-pago';
import { handlePaymentNotification } from '@/server/payments/webhook';

// URL que ya tiene configurada el servicio que reenvía los avisos de Mercado
// Pago. Equivale a /api/payments/mercadopago.
export async function POST(request: Request) {
  return handlePaymentNotification(request, mercadoPagoProvider);
}
