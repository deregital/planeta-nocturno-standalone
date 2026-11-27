import { WithdrawalsClient } from '@/app/(backoffice)/admin/arrepentimientos/client';
import { requirePagePermission } from '@/server/rbac/guards';

export default async function WithdrawalsPage() {
  await requirePagePermission('withdrawals:manage');
  return <WithdrawalsClient />;
}
