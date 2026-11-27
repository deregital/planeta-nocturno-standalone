import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import { Resend } from 'resend';

import { retryWithBackoff } from '@/server/utils/retry';

const resend = new Resend(process.env.RESEND_API_KEY);

type MailInstance = Pick<ResolvedInstance, 'name' | 'publicUrl'>;

export async function sendMail(
  instance: MailInstance,
  {
    to,
    subject,
    body,
    attachments,
    eventName,
  }: {
    to: string;
    subject: string;
    body: string;
    attachments: Buffer[];
    eventName: string;
  },
) {
  return await resend.emails.send({
    from: `${instance.name} <ticket@${process.env.RESEND_DOMAIN}>`,
    to: to,
    subject: subject,
    text: body,
    attachments: await Promise.all(
      attachments.map(async (pdf) => ({
        content: pdf,
        filename: `${instance.name}-${eventName}.pdf`,
        contentType: 'application/pdf',
      })),
    ),
  });
}

export async function sendMailWithoutAttachments(
  instance: MailInstance,
  {
    to,
    subject,
    body,
    html,
  }:
    | {
        to: string;
        subject: string;
        body: string;
        html?: string;
      }
    | {
        to: string;
        subject: string;
        html: string;
        body?: string;
      },
) {
  return await resend.emails.send({
    from: `${instance.name} <ticket@${process.env.RESEND_DOMAIN}>`,
    to: to,
    subject: subject,
    text: body ?? '',
    html: html ?? '',
  });
}

export async function sendMailService(
  instance: MailInstance,
  {
    eventName,
    receiver,
    subject,
    body,
    attatchments,
  }: {
    eventName: string;
    receiver: string;
    subject: string;
    body: string;
    attatchments: Blob[];
  },
) {
  const attachments = await Promise.all(
    attatchments.map(async (pdf) => Buffer.from(await pdf.arrayBuffer())),
  );

  const result = await retryWithBackoff(
    async () =>
      await sendMail(instance, {
        to: receiver,
        subject,
        body,
        attachments,
        eventName,
      }),
    3, // intentos máximos
    2000, // segundos de delay
  );

  if (result.error) {
    throw new Error(`Error al enviar el mail: ${JSON.stringify(result.error)}`);
  }

  return result.data;
}

export function generateTicketEmailBody(
  instance: Pick<ResolvedInstance, 'name' | 'contactEmail'>,
  eventName: string,
) {
  const contact = instance.contactEmail
    ? ` Para dudas y consultas, contactarse a ${instance.contactEmail}.`
    : '';
  return `¡Gracias por elegir ${instance.name}! Te enviamos el/los ticket/s de ${eventName}.${contact}`;
}

export function generateWelcomeEmail(
  instance: MailInstance,
  name: string,
  password: string,
) {
  return `
    <h1>Bienvenido a la plataforma ${instance.name}!</h1>
    <p>Tu nombre de usuario es <b>${name}</b> y tu contraseña es <b>${password}</b></p>
    <p>Para acceder a la plataforma, ingresá a <a href="${instance.publicUrl}/admin">${instance.publicUrl}/admin</a>.</p>
    <p>Gracias por unirte a nuestra plataforma.</p>
  `;
}

export function generateTransferPaymentEmail(
  instance: Pick<ResolvedInstance, 'name' | 'contactEmail'>,
  {
    eventName,
    totalAmount,
    transferAlias,
    buyerName,
  }: {
    eventName: string;
    totalAmount: string;
    transferAlias: string;
    buyerName: string;
  },
) {
  const safeBuyerName = buyerName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const nameNote = safeBuyerName
    ? ` Si la cuenta desde la que transferís está a otro nombre, indicá en ese mail el nombre que cargaste en la compra: <b>${safeBuyerName}</b>.`
    : '';
  const receiptInstructions = instance.contactEmail
    ? `<p>Una vez hecha la transferencia, enviá el comprobante a <a href="mailto:${instance.contactEmail}">${instance.contactEmail}</a>.${nameNote}</p>`
    : `<p>Una vez hecha la transferencia, enviá el comprobante a los organizadores del evento.${nameNote}</p>`;
  return `
    <h1>Completá el pago de tus entradas para ${eventName}</h1>
    <p>Tu reserva en <b>${instance.name}</b> quedó registrada. Para recibir las entradas, transferí el total de la compra:</p>
    <ul>
      <li>Alias / CBU: <b>${transferAlias}</b></li>
      <li>Monto: <b>${totalAmount}</b></li>
    </ul>
    ${receiptInstructions}
    <p>Cuando los organizadores confirmen el pago, te vamos a enviar las entradas a este mail.</p>
  `;
}

/** Datos para pagar por Talo: CVU propio de la compra, se confirma solo. */
export function generateTaloPaymentEmail(
  instance: Pick<ResolvedInstance, 'name'>,
  {
    eventName,
    totalAmount,
    cvu,
    alias,
    expiresAt,
    paymentPageUrl,
  }: {
    eventName: string;
    totalAmount: string;
    cvu: string;
    alias: string | null;
    expiresAt: string | null;
    paymentPageUrl: string;
  },
) {
  return `
    <h1>Completá el pago de tus entradas para ${eventName}</h1>
    <p>Tu reserva en <b>${instance.name}</b> quedó registrada. Transferí el monto exacto desde tu banco o billetera:</p>
    <ul>
      <li>CVU: <b>${cvu}</b></li>
      ${alias ? `<li>Alias: <b>${alias}</b></li>` : ''}
      <li>Monto: <b>${totalAmount}</b></li>
    </ul>
    <p><b>Transferí el monto exacto.</b> Si transferís de más, la transferencia queda retenida para revisión y tus entradas se demoran.</p>
    ${expiresAt ? `<p>Estos datos sirven hasta las <b>${expiresAt}</b> hs.</p>` : ''}
    <p>No hace falta mandar comprobante: cuando se acredita la transferencia te enviamos las entradas a este mail. Podés ver el estado en <a href="${paymentPageUrl}">tu compra</a>.</p>
  `;
}

/** Al comprador: transfirió menos de lo que salen las entradas. */
export function generateTaloUnderpaidEmail({
  eventName,
  received,
  missing,
  cvu,
  expiresAt,
  paymentPageUrl,
}: {
  eventName: string;
  received: string;
  missing: string;
  cvu: string;
  expiresAt: string | null;
  paymentPageUrl: string;
}) {
  return `
    <h1>Te falta completar el pago de ${eventName}</h1>
    <p>Recibimos <b>${received}</b>. Para recibir tus entradas transferí los <b>${missing}</b> que faltan al mismo CVU:</p>
    <ul><li>CVU: <b>${cvu}</b></li><li>Monto que falta: <b>${missing}</b></li></ul>
    ${expiresAt ? `<p>El CVU sirve hasta las <b>${expiresAt}</b> hs.</p>` : ''}
    <p>Cuando se acredite te mandamos las entradas a este mail. Podés ver el estado en <a href="${paymentPageUrl}">tu compra</a>.</p>
  `;
}

export type PaymentIssueKind =
  | 'UNDERPAID'
  | 'OVERPAID'
  | 'LATE'
  | 'UNKNOWN_PURCHASE'
  | 'OVER_QUOTA'
  | 'REFUND_FAILED';

const PAYMENT_ISSUE_TEXT: Record<
  PaymentIssueKind,
  { subject: string; body: string }
> = {
  UNDERPAID: {
    subject: 'Un comprador transfirió de menos',
    body: 'Le avisamos al comprador que transfiera lo que falta al mismo CVU. Si no lo completa, desde Compras podés aceptar lo que pagó y entregarle las entradas, o cancelar la compra y devolverle la plata por Talo.',
  },
  OVERPAID: {
    subject: 'Un comprador transfirió de más',
    body: 'Le entregamos las entradas. Desde Compras podés devolverle la diferencia por Talo.',
  },
  LATE: {
    subject: 'Llegó una transferencia de una reserva vencida',
    body: 'La reserva ya había liberado las entradas y no se pudieron entregar: el evento ya no tenía lugar para ese tipo de entrada, o el pago no estaba completo. Le pedimos a Talo que le devuelva la plata al comprador.',
  },
  UNKNOWN_PURCHASE: {
    subject: 'Llegó una transferencia de una compra que ya no existe',
    body: 'No había ninguna compra esperando ese pago, así que no se entregaron entradas. Le pedimos a Talo que le devuelva la plata a quien la transfirió.',
  },
  OVER_QUOTA: {
    subject: 'Se entregaron entradas por encima del cupo',
    body: 'El pago llegó después de que la reserva liberara las entradas y el tipo ya se había vendido. Como la plata se cobró, las entradas se entregaron igual: el evento quedó por encima del cupo.',
  },
  REFUND_FAILED: {
    subject: 'No se pudo devolver una transferencia',
    body: 'Talo no aceptó la devolución automática. Devolvé la plata desde tu panel de Talo.',
  },
};

export function paymentIssueSubject(kind: PaymentIssueKind) {
  return PAYMENT_ISSUE_TEXT[kind].subject;
}

/** Al contacto de la plataforma: un pago necesita su atención. */
export function generatePaymentIssueEmail({
  kind,
  eventName,
  buyer,
  expected,
  received,
  purchasesUrl,
}: {
  kind: PaymentIssueKind;
  eventName: string | null;
  buyer: string | null;
  expected: string | null;
  received: string | null;
  purchasesUrl: string | null;
}) {
  const text = PAYMENT_ISSUE_TEXT[kind];
  // Nombre y mail los cargó el comprador.
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = [
    eventName && `<li>Evento: <b>${escape(eventName)}</b></li>`,
    buyer && `<li>Comprador: <b>${escape(buyer)}</b></li>`,
    expected && `<li>Precio: <b>${expected}</b></li>`,
    received && `<li>Transferido: <b>${received}</b></li>`,
  ].filter(Boolean);
  return `
    <h1>${text.subject}</h1>
    ${rows.length > 0 ? `<ul>${rows.join('')}</ul>` : ''}
    <p>${text.body}</p>
    ${purchasesUrl ? `<p><a href="${purchasesUrl}">Ver las compras del evento</a></p>` : ''}
  `;
}

function unlinkConsequence(
  instance: Pick<ResolvedInstance, 'contactEmail'>,
  transferAlias: string | null,
) {
  if (!transferAlias) {
    return 'No se van a poder cobrar entradas online ni crear tickets pagos hasta que se vuelva a conectar una cuenta de Mercado Pago.';
  }

  const receipt = instance.contactEmail
    ? ` a <a href="mailto:${instance.contactEmail}">${instance.contactEmail}</a>`
    : '';
  return `Las entradas pagas se cobran por transferencia al alias <b>${transferAlias}</b>. El comprador tiene que enviar el comprobante${receipt} y las entradas se liberan desde la página del evento.`;
}

function lowerFirst(value: string) {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

export function generateMercadoPagoUnlinkRequestEmail(
  instance: MailInstance & Pick<ResolvedInstance, 'contactEmail'>,
  link: string,
  expiresInMinutes: number,
  transferAlias: string | null,
) {
  return `
    <h1>Confirmá la desvinculación de Mercado Pago</h1>
    <p>Recibimos un pedido para desvincular la cuenta de Mercado Pago de la plataforma <b>${instance.name}</b>.</p>
    <p>Una vez desvinculada, ${lowerFirst(unlinkConsequence(instance, transferAlias))}</p>
    <p>Para confirmar, ingresá al siguiente link con tu usuario de la plataforma. El link vence en ${expiresInMinutes} minutos y se puede usar una sola vez.</p>
    <p><a href="${link}">Confirmar desvinculación de Mercado Pago</a></p>
    <p><b>Si no pediste la desvinculación, ignorá este mail</b>: la cuenta de Mercado Pago sigue vinculada. Te recomendamos cambiar tu contraseña.</p>
  `;
}

export function generateMercadoPagoUnlinkedEmail(
  instance: MailInstance & Pick<ResolvedInstance, 'contactEmail'>,
  pending: boolean,
  transferAlias: string | null,
) {
  const consequence = unlinkConsequence(instance, transferAlias);
  const status = pending
    ? `La desvinculación está en proceso y puede tardar unos minutos en completarse. Cuando termine, ${lowerFirst(consequence)}`
    : consequence;
  return `
    <h1>Mercado Pago fue desvinculado</h1>
    <p>Se confirmó la desvinculación de la cuenta de Mercado Pago de la plataforma <b>${instance.name}</b>.</p>
    <p>${status}</p>
    <p>Para conectar una cuenta nuevamente, ingresá a <a href="${instance.publicUrl}/admin/settings">${instance.publicUrl}/admin/settings</a>.</p>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateWithdrawalLinkEmail(
  instance: MailInstance,
  link: string,
  expiresInHours: number,
) {
  return `
    <h1>Elegí la compra de la que te querés arrepentir</h1>
    <p>Recibimos un pedido de arrepentimiento en <b>${escapeHtml(instance.name)}</b> con este mail.</p>
    <p><a href="${link}">Ver mis compras</a></p>
    <p>El link vence en ${expiresInHours} horas. Las entradas no se anulan hasta que confirmes.</p>
    <p>Si no lo pediste, ignorá este mail: tus entradas siguen valiendo.</p>
  `;
}

export function generateWithdrawalReceiptEmail(
  instance: MailInstance & Pick<ResolvedInstance, 'contactEmail'>,
  {
    number,
    eventName,
    ticketCount,
    amount,
    serviceFeeAmount,
    refundAccount,
  }: {
    number: string;
    eventName: string;
    ticketCount: number;
    amount: string;
    serviceFeeAmount: string | null;
    refundAccount: string;
  },
) {
  const fee = serviceFeeAmount
    ? ` (incluye ${serviceFeeAmount} de cargo por servicio)`
    : '';
  const contact = instance.contactEmail
    ? `<p>Ante cualquier duda, escribí a <a href="mailto:${instance.contactEmail}">${instance.contactEmail}</a> con tu número de trámite.</p>`
    : '';
  return `
    <h1>Recibimos tu arrepentimiento</h1>
    <p>Tu número de trámite es <b>${number}</b>.</p>
    <ul>
      <li>Evento: <b>${escapeHtml(eventName)}</b></li>
      <li>Entradas anuladas: <b>${ticketCount}</b></li>
      <li>Monto a devolver: <b>${amount}</b>${fee}</li>
      <li>Cuenta para la devolución: <b>${escapeHtml(refundAccount)}</b></li>
    </ul>
    <p>Las entradas ya no sirven para entrar. ${escapeHtml(instance.name)} te va a transferir el dinero a esa cuenta.</p>
    ${contact}
  `;
}

export function generateWithdrawalNoticeEmail(
  instance: MailInstance,
  {
    number,
    eventName,
    buyerName,
    buyerMail,
    buyerDni,
    ticketCount,
    amount,
    paymentMethod,
    refundAccount,
  }: {
    number: string;
    eventName: string;
    buyerName: string;
    buyerMail: string;
    buyerDni: string;
    ticketCount: number;
    amount: string;
    paymentMethod: string;
    refundAccount: string;
  },
) {
  return `
    <h1>Nuevo arrepentimiento ${number}</h1>
    <p>Un comprador usó el botón de arrepentimiento. Las entradas ya quedaron anuladas.</p>
    <ul>
      <li>Evento: <b>${escapeHtml(eventName)}</b></li>
      <li>Comprador: <b>${escapeHtml(buyerName)}</b> (${escapeHtml(buyerMail)}, DNI ${escapeHtml(buyerDni)})</li>
      <li>Entradas anuladas: <b>${ticketCount}</b></li>
      <li>Monto a devolver: <b>${amount}</b> (cargo por servicio incluido)</li>
      <li>Pagó con: <b>${paymentMethod}</b></li>
      <li>Transferir a: <b>${escapeHtml(refundAccount)}</b> (CBU, CVU o alias)</li>
    </ul>
    <p>Transferí el total a esa cuenta y marcalo como reintegrado en la plataforma.</p>
    <p><a href="${instance.publicUrl}/admin/arrepentimientos">Ver arrepentimientos</a></p>
  `;
}
