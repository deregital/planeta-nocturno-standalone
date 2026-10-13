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

export function generateMercadoPagoUnlinkRequestEmail(
  instance: MailInstance,
  link: string,
  expiresInMinutes: number,
) {
  return `
    <h1>Confirmá la desvinculación de Mercado Pago</h1>
    <p>Recibimos un pedido para desvincular la cuenta de Mercado Pago de la plataforma <b>${instance.name}</b>.</p>
    <p>Una vez desvinculada, no se van a poder cobrar entradas online hasta que se vuelva a conectar una cuenta.</p>
    <p>Para confirmar, ingresá al siguiente link con tu usuario de la plataforma. El link vence en ${expiresInMinutes} minutos y se puede usar una sola vez.</p>
    <p><a href="${link}">Confirmar desvinculación de Mercado Pago</a></p>
    <p><b>Si no pediste la desvinculación, ignorá este mail</b>: la cuenta de Mercado Pago sigue vinculada. Te recomendamos cambiar tu contraseña.</p>
  `;
}

export function generateMercadoPagoUnlinkedEmail(
  instance: MailInstance,
  pending: boolean,
) {
  const status = pending
    ? 'La desvinculación está en proceso y puede tardar unos minutos en completarse.'
    : 'Desde ahora no se pueden cobrar entradas online hasta que se vuelva a conectar una cuenta.';
  return `
    <h1>Mercado Pago fue desvinculado</h1>
    <p>Se confirmó la desvinculación de la cuenta de Mercado Pago de la plataforma <b>${instance.name}</b>.</p>
    <p>${status}</p>
    <p>Para conectar una cuenta nuevamente, ingresá a <a href="${instance.publicUrl}/admin/settings">${instance.publicUrl}/admin/settings</a>.</p>
  `;
}
