'use server';

import { createHash } from 'crypto';

import { cookies, headers } from 'next/headers';
import { after } from 'next/server';
import { z } from 'zod';

import {
  WITHDRAWAL_LINK_TTL_HOURS,
  WITHDRAWAL_PATH,
  parseRefundAccount,
  withdrawalPaymentMethodLabel,
} from '@/lib/withdrawal';
import { formatCurrency } from '@/lib/utils';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { resolveContactEmail } from '@/server/legal';
import { logger } from '@/server/observability/logger';
import { consumeRateLimit, getClientIpKey } from '@/server/security/rate-limit';
import {
  generateWithdrawalLinkEmail,
  generateWithdrawalNoticeEmail,
  generateWithdrawalReceiptEmail,
  sendMailWithoutAttachments,
} from '@/server/services/mail';
import {
  confirmWithdrawal,
  createWithdrawalToken,
  hasWithdrawalMatches,
  normalizeWithdrawalDni,
  normalizeWithdrawalMail,
  readWithdrawalToken,
  WITHDRAWAL_COOKIE,
  WithdrawalNotAllowedError,
} from '@/server/services/withdrawal';

export type RequestLinkState =
  | { status: 'idle'; values?: { mail: string; dni: string } }
  | { status: 'sent'; mail: string }
  | {
      status: 'error';
      values: { mail: string; dni: string };
      errors: { mail?: string; dni?: string; form?: string };
    };

const requestSchema = z.object({
  mail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Ingresá un mail válido' })),
  dni: z
    .string()
    .transform(normalizeWithdrawalDni)
    .pipe(
      z
        .string()
        .min(4, { error: 'Ingresá un DNI válido' })
        .max(20, { error: 'Ingresá un DNI válido' }),
    ),
});

const IP_LIMIT = { limit: 10, windowSeconds: 60 * 60 };
const MAIL_LIMIT = { limit: 3, windowSeconds: 60 * 60 };

function hashKey(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

/**
 * Siempre responde "Revisá tu mail": si hay compras o no, se sabe sólo desde
 * el mail. Nadie puede averiguar compras ajenas con un DNI. El mail se arma y
 * se manda después de responder, así la demora tampoco lo delata.
 */
export async function requestWithdrawalLink(
  _prev: RequestLinkState,
  formData: FormData,
): Promise<RequestLinkState> {
  const values = {
    mail: formData.get('mail')?.toString() ?? '',
    dni: formData.get('dni')?.toString() ?? '',
  };
  const parsed = requestSchema.safeParse(values);
  if (!parsed.success) {
    const errors: { mail?: string; dni?: string } = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === 'mail' || field === 'dni') && !errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { status: 'error', values, errors };
  }

  const { db, instance } = await getCurrentRequestContext();
  const ipAllowed = await consumeRateLimit(db, [
    {
      key: `withdrawal:ip:${getClientIpKey(await headers())}`,
      ...IP_LIMIT,
    },
  ]);
  if (!ipAllowed) {
    return {
      status: 'error',
      values,
      errors: {
        form: 'Hiciste muchos pedidos seguidos. Probá de nuevo en un rato.',
      },
    };
  }

  const access = parsed.data;
  // Pasado el límite se responde igual, sin mandar otro mail. Va por mail y
  // DNI: con un DNI inventado nadie le agota los pedidos a otra persona.
  const mailAllowed = await consumeRateLimit(db, [
    {
      key: `withdrawal:mail:${hashKey(`${access.mail}:${access.dni}`)}`,
      ...MAIL_LIMIT,
    },
  ]);

  if (mailAllowed) {
    after(async () => {
      try {
        if (!(await hasWithdrawalMatches(db, access))) return;
        const token = createWithdrawalToken(access, instance.slug);
        const link = `${instance.publicUrl}${WITHDRAWAL_PATH}/abrir?t=${token}`;
        const result = await sendMailWithoutAttachments(instance, {
          to: access.mail,
          subject: `Tu link para arrepentirte de una compra en ${instance.name}`,
          html: generateWithdrawalLinkEmail(
            instance,
            link,
            WITHDRAWAL_LINK_TTL_HOURS,
          ),
        });
        if (result.error) throw result.error;
      } catch (error) {
        logger.error('Withdrawal link email failed', {
          operation: 'withdrawal_link',
          error,
        });
      }
    });
  }

  return { status: 'sent', mail: access.mail };
}

export type ConfirmWithdrawalResult =
  | {
      ok: true;
      number: string;
      mail: string;
      amount: number;
      refundAccount: string;
    }
  | {
      ok: false;
      error: string;
      linkExpired?: boolean;
      /** El error es del CBU, CVU o alias: se muestra debajo del campo. */
      field?: 'refundAccount';
    };

export async function confirmWithdrawalAction(
  ticketGroupId: string,
  refundAccountInput: string,
): Promise<ConfirmWithdrawalResult> {
  if (!z.uuid().safeParse(ticketGroupId).success) {
    return { ok: false, error: 'Elegí una compra.' };
  }
  const parsedAccount = parseRefundAccount(String(refundAccountInput ?? ''));
  if (!parsedAccount.ok) {
    return { ok: false, error: parsedAccount.error, field: 'refundAccount' };
  }
  const refundAccount = parsedAccount.account;

  const { db, instance } = await getCurrentRequestContext();
  const token = (await cookies()).get(WITHDRAWAL_COOKIE)?.value;
  const access = token ? readWithdrawalToken(token, instance.slug) : null;
  if (!access) {
    return {
      ok: false,
      linkExpired: true,
      error: 'El link venció. Pedí uno nuevo para seguir.',
    };
  }

  let result: Awaited<ReturnType<typeof confirmWithdrawal>>;
  try {
    result = await confirmWithdrawal(db, access, ticketGroupId, refundAccount);
  } catch (error) {
    if (error instanceof WithdrawalNotAllowedError) {
      return { ok: false, error: error.message };
    }
    logger.error('Withdrawal confirmation failed', {
      operation: 'withdrawal_confirm',
      ticketGroupId,
      error,
    });
    return {
      ok: false,
      error: 'No pudimos registrar el arrepentimiento. Probá de nuevo.',
    };
  }

  const { purchase, number } = result;
  logger.info('Withdrawal requested', {
    operation: 'withdrawal_confirm',
    ticketGroupId,
    eventId: purchase.eventId,
    number,
    ticketCount: purchase.ticketCount,
  });

  after(async () => {
    const contactEmail = resolveContactEmail(instance);
    const mails = [
      {
        kind: 'receipt',
        to: access.mail,
        subject: `Arrepentimiento ${number}: recibimos tu pedido`,
        html: generateWithdrawalReceiptEmail(
          { ...instance, contactEmail },
          {
            number,
            eventName: purchase.eventName,
            ticketCount: purchase.ticketCount,
            amount: formatCurrency(purchase.amount),
            serviceFeeAmount:
              purchase.serviceFeeAmount > 0
                ? formatCurrency(purchase.serviceFeeAmount)
                : null,
            refundAccount: refundAccount.value,
          },
        ),
      },
      ...(contactEmail
        ? [
            {
              kind: 'notice',
              to: contactEmail,
              subject: `Nuevo arrepentimiento ${number} · ${purchase.eventName}`,
              html: generateWithdrawalNoticeEmail(instance, {
                number,
                eventName: purchase.eventName,
                buyerName: purchase.buyerName,
                buyerMail: normalizeWithdrawalMail(access.mail),
                buyerDni: access.dni,
                ticketCount: purchase.ticketCount,
                amount: formatCurrency(purchase.amount),
                paymentMethod: withdrawalPaymentMethodLabel(
                  purchase.paymentMethod,
                ),
                refundAccount: refundAccount.value,
              }),
            },
          ]
        : []),
    ];
    for (const mail of mails) {
      try {
        const sent = await sendMailWithoutAttachments(instance, {
          to: mail.to,
          subject: mail.subject,
          html: mail.html,
        });
        if (sent.error) throw sent.error;
      } catch (error) {
        logger.error('Withdrawal email failed', {
          operation: 'withdrawal_confirm',
          kind: mail.kind,
          number,
          error,
        });
      }
    }
  });

  return {
    ok: true,
    number,
    mail: access.mail,
    amount: purchase.amount,
    refundAccount: refundAccount.value,
  };
}
