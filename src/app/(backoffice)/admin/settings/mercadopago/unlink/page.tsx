import UnlinkMercadoPagoClient from '@/app/(backoffice)/admin/settings/mercadopago/unlink/client';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { requirePagePermission } from '@/server/rbac/guards';
import { isUnlinkTokenValid } from '@/server/services/mercadoPagoUnlink';

export default async function UnlinkMercadoPagoPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const access = await requirePagePermission('mercadopago:unlink');
  const { token } = await searchParams;
  const { instance } = await getCurrentRequestContext();

  const candidate = typeof token === 'string' && token ? token : null;
  const validToken =
    candidate && isUnlinkTokenValid(instance, candidate, access.userId)
      ? candidate
      : null;

  return (
    <UnlinkMercadoPagoClient
      token={validToken}
      isConnected={Boolean(
        instance.mercadoPagoAccessToken && instance.mercadoPagoRefreshToken,
      )}
    />
  );
}
