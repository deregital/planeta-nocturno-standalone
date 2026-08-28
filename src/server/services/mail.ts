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
