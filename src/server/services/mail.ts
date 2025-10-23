import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMail({
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
}) {
  return await resend.emails.send({
    from: `${process.env.NEXT_PUBLIC_INSTANCE_NAME} <ticket@${process.env.RESEND_DOMAIN}>`,
    to: to,
    subject: subject,
    text: body,
    attachments: await Promise.all(
      attachments.map(async (pdf) => ({
        content: pdf,
        filename: `${process.env.NEXT_PUBLIC_INSTANCE_NAME}-${eventName}.pdf`,
        contentType: 'application/pdf',
      })),
    ),
  });
}

export async function sendMailWithoutAttachments({
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
    }) {
  return await resend.emails.send({
    from: `${process.env.NEXT_PUBLIC_INSTANCE_NAME} <ticket@${process.env.RESEND_DOMAIN}>`,
    to: to,
    subject: subject,
    text: body ?? '',
    html: html ?? '',
  });
}

export function generateWelcomeEmail(name: string, password: string) {
  return `
    <h1>Bienvenido a la plataforma ${process.env.NEXT_PUBLIC_INSTANCE_NAME}!</h1>
    <p>Tu nombre de usuario es <b>${name}</b> y tu contraseña es <b>${password}</b>.</p>
    <p>Para acceder a la plataforma, ingresá a <a href="${process.env.INSTANCE_WEB_URL}">${process.env.INSTANCE_WEB_URL}</a>.</p>
    <p>Gracias por unirte a nuestra plataforma.</p>
  `;
}
