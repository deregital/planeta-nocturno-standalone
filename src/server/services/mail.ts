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
}: {
  to: string;
  subject: string;
  body: string;
}) {
  return await resend.emails.send({
    from: `${process.env.NEXT_PUBLIC_INSTANCE_NAME} <ticket@${process.env.RESEND_DOMAIN}>`,
    to: to,
    subject: subject,
    text: body,
  });
}
