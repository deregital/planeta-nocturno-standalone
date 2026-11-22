import type { Metadata, Route } from 'next';

import { Clock } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';

import { WithdrawalFlow } from '@/app/(client)/arrepentimiento/compras/flow';
import { Button } from '@/components/ui/button';
import { WITHDRAWAL_PATH } from '@/lib/withdrawal';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { getLegalContext } from '@/server/legal';
import {
  listWithdrawalPurchases,
  readWithdrawalToken,
  WITHDRAWAL_COOKIE,
} from '@/server/services/withdrawal';

export async function generateMetadata(): Promise<Metadata> {
  const { producerName } = await getLegalContext();
  return { title: `Elegí la compra · ${producerName}` };
}

export default async function WithdrawalPurchasesPage() {
  const { db, instance } = await getCurrentRequestContext();
  const token = (await cookies()).get(WITHDRAWAL_COOKIE)?.value;
  const access = token ? readWithdrawalToken(token, instance.slug) : null;

  if (!access) {
    return (
      <main className='mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-8 text-center text-accent-dark sm:py-12'>
        <Clock className='size-12 text-accent' aria-hidden />
        <h1 className='text-3xl font-bold'>El link venció</h1>
        <p>Pedí uno nuevo con el mail y el DNI de la compra.</p>
        <Button asChild variant='accent' className='w-full'>
          <Link href={WITHDRAWAL_PATH as Route}>Pedir un link nuevo</Link>
        </Button>
      </main>
    );
  }

  const [list, { contactEmail }] = await Promise.all([
    listWithdrawalPurchases(db, access),
    getLegalContext(),
  ]);

  return (
    <main className='mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8 text-accent-dark sm:py-12'>
      <WithdrawalFlow
        mail={access.mail}
        purchases={list.purchases}
        requests={list.requests}
        contactEmail={contactEmail}
      />
    </main>
  );
}
