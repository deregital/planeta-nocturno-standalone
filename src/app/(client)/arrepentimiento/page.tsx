import type { Metadata } from 'next';

import { cookies } from 'next/headers';

import { WithdrawalRequestForm } from '@/app/(client)/arrepentimiento/request-form';
import { getLegalContext } from '@/server/legal';

export async function generateMetadata(): Promise<Metadata> {
  const { producerName } = await getLegalContext();
  return { title: `Botón de arrepentimiento · ${producerName}` };
}

/** La última compra de este navegador, para no tipear el mail y el DNI. */
async function lastPurchaseValues() {
  try {
    const raw = (await cookies()).get('lastPurchase')?.value;
    const parsed = raw
      ? (JSON.parse(raw) as { mail?: unknown; dni?: unknown })
      : {};
    return {
      mail: typeof parsed.mail === 'string' ? parsed.mail : '',
      dni: typeof parsed.dni === 'string' ? parsed.dni : '',
    };
  } catch {
    return { mail: '', dni: '' };
  }
}

export default async function WithdrawalPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  const { link } = await searchParams;

  return (
    <main className='mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8 text-accent-dark sm:py-12'>
      <WithdrawalRequestForm
        linkExpired={link === 'vencido'}
        defaultValues={await lastPurchaseValues()}
      />
    </main>
  );
}
