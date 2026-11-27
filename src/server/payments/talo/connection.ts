import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { taloConnection } from '@/drizzle/schema';
import { logger } from '@/server/observability/logger';
import {
  exchangeTaloCode,
  getTaloAccountStatus,
  TALO_ACCOUNT_STATUSES,
  type TaloAccountStatus,
  type TaloConnection,
  TaloError,
  taloAppUrl,
  taloPartner,
} from '@/server/payments/talo/client';
import { decryptString, encryptString } from '@/server/utils/utils';

const ROW_ID = 1;
/** Cuánto tiene quien tocó "Conectar con Talo" para volver con el código. */
const CONNECT_WINDOW_MS = 15 * 60 * 1000;
/** Mientras la cuenta no está activa, su estado se vuelve a consultar cada 10 min. */
const STATUS_RECHECK_MS = 10 * 60 * 1000;

/**
 * - `INVALID`: Talo ya no acepta el token (se revocó o venció): hay que
 *   volver a conectar.
 */
export type TaloConnectionStatus = TaloAccountStatus | 'INVALID' | 'UNKNOWN';

export type TaloConnectionState = TaloConnection & {
  status: TaloConnectionStatus;
  statusCheckedAt: string | null;
};

/**
 * Lo que va en `referred_user_id`: identifica a la plataforma para que el
 * callback del dominio raíz sepa a cuál volver.
 */
export function taloReferredUserId(instance: ResolvedInstance) {
  return instance.slug ?? 'default';
}

function parseStatus(value: string | null): TaloConnectionStatus {
  if (value === 'INVALID') return 'INVALID';
  return TALO_ACCOUNT_STATUSES.find((status) => status === value) ?? 'UNKNOWN';
}

async function readRow(db: Db) {
  return db.query.taloConnection.findFirst({
    where: eq(taloConnection.id, ROW_ID),
  });
}

/** La cuenta de Talo conectada, o null si no hay. */
export async function getTaloConnection(
  db: Db,
): Promise<TaloConnectionState | null> {
  const row = await readRow(db);
  if (!row?.token || !row.taloUserId) return null;
  return {
    userId: row.taloUserId,
    token: decryptString(row.token),
    status: parseStatus(row.accountStatus),
    statusCheckedAt: row.statusCheckedAt,
  };
}

async function saveStatus(db: Db, status: TaloConnectionStatus) {
  await db
    .update(taloConnection)
    .set({ accountStatus: status, statusCheckedAt: new Date().toISOString() })
    .where(eq(taloConnection.id, ROW_ID));
}

async function fetchStatus(
  connection: TaloConnection,
): Promise<TaloConnectionStatus> {
  try {
    return await getTaloAccountStatus(connection);
  } catch (error) {
    if (
      error instanceof TaloError &&
      (error.status === 401 || error.status === 403)
    ) {
      return 'INVALID';
    }
    throw error;
  }
}

/**
 * Vuelve a consultar el estado de la cuenta si no está activa y pasó un rato
 * (o siempre, con `force`). Talo tarda hasta 36 h en activar una cuenta nueva.
 */
export async function refreshTaloStatus(
  db: Db,
  connection: TaloConnectionState,
  { force = false } = {},
): Promise<TaloConnectionStatus> {
  const stale =
    !connection.statusCheckedAt ||
    Date.now() - new Date(connection.statusCheckedAt).getTime() >
      STATUS_RECHECK_MS;
  if (connection.status === 'ACTIVE' && !force) return 'ACTIVE';
  if (!force && !stale) return connection.status;
  try {
    const status = await fetchStatus(connection);
    await saveStatus(db, status);
    return status;
  } catch (error) {
    logger.warn('Talo account status check failed', { error });
    return connection.status;
  }
}

/** Si la cuenta conectada puede cobrar. */
export async function isTaloReady(db: Db) {
  if (!taloPartner()) return false;
  const connection = await getTaloConnection(db);
  if (!connection) return false;
  return (await refreshTaloStatus(db, connection)) === 'ACTIVE';
}

/**
 * Registra quién empieza a conectar y devuelve la pantalla de autorización
 * de Talo a la que hay que mandarlo.
 */
export async function startTaloConnect(
  db: Db,
  instance: ResolvedInstance,
  userId: string,
) {
  const partner = taloPartner();
  if (!partner) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Talo no está habilitado en esta plataforma',
    });
  }
  const pending = {
    pendingSince: new Date().toISOString(),
    pendingByUserId: userId,
  };
  await db
    .insert(taloConnection)
    .values({ id: ROW_ID, ...pending })
    .onConflictDoUpdate({ target: taloConnection.id, set: pending });

  const url = new URL(
    `/authorize/${encodeURIComponent(partner.id)}`,
    taloAppUrl(),
  );
  url.searchParams.set('referred_user_id', taloReferredUserId(instance));
  return url.toString();
}

/**
 * Completa la conexión con el código que devolvió Talo. Sólo la persona que
 * tocó "Conectar con Talo" hace un rato: sin eso, un link con un código
 * ajeno conectaría la plataforma a la cuenta de Talo de otro (y los cobros
 * irían a esa cuenta).
 */
export async function completeTaloConnect(
  db: Db,
  instance: ResolvedInstance,
  {
    userId,
    code,
    referredUserId,
  }: {
    userId: string;
    code: string;
    referredUserId: string | null;
  },
) {
  const row = await readRow(db);
  const pendingFresh =
    row?.pendingSince &&
    Date.now() - new Date(row.pendingSince).getTime() < CONNECT_WINDOW_MS;
  if (!row || row.pendingByUserId !== userId || !pendingFresh) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message:
        'La conexión con Talo venció o la empezó otra persona. Volvé a tocar "Conectar con Talo".',
    });
  }
  if (referredUserId && referredUserId !== taloReferredUserId(instance)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'La autorización de Talo es de otra plataforma',
    });
  }

  let exchanged: Awaited<ReturnType<typeof exchangeTaloCode>>;
  try {
    exchanged = await exchangeTaloCode(code);
  } catch (error) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        error instanceof TaloError && error.status < 500
          ? 'Talo no aceptó la autorización (el código vence a los 5 minutos). Volvé a conectar.'
          : 'No pudimos comunicarnos con Talo. Probá de nuevo en un momento.',
      cause: error,
    });
  }

  const connection = { userId: exchanged.user_id, token: exchanged.token };
  let status: TaloConnectionStatus = 'UNKNOWN';
  try {
    status = await fetchStatus(connection);
  } catch (error) {
    logger.warn('Talo account status check failed', { error });
  }

  const now = new Date().toISOString();
  await db
    .update(taloConnection)
    .set({
      taloUserId: connection.userId,
      token: encryptString(connection.token),
      accountStatus: status,
      statusCheckedAt: now,
      connectedAt: now,
      pendingSince: null,
      pendingByUserId: null,
    })
    .where(eq(taloConnection.id, ROW_ID));
  return status;
}

export async function clearTaloConnection(db: Db) {
  await db.delete(taloConnection).where(eq(taloConnection.id, ROW_ID));
}
