import { emittedTicket } from '@/drizzle/schema';
import { publicProcedure, router } from '@/server/trpc';
import z from 'zod';
import { generate } from '@pdfme/generator';
import { generateTicketTemplate } from '@/utils/ticket-template';
import { encryptString } from '@/lib/utils';
import { barcodes, image, line, text } from '@pdfme/schemas';

export const createManyTicketFullSchema = z
  .object({
    fullName: z.string(),
    age: z.number().int().min(0),
    dni: z.string(),
    mail: z.email(),
    gender: z.string(),
    phoneNumber: z.string(),
    instagram: z.string().optional(),
    birthDate: z.string(),
    ticketTypeId: z.uuid(),
    ticketGroupId: z.uuid(),
    paidOnLocation: z.boolean(),
    eventId: z.uuid().nullable().optional(),
    scannedByUserId: z.uuid().nullable(),
  })
  .array();

export const createManyTicketSchema = z
  .object({
    id: z.string(),
    fullName: z.string(),
    dni: z.string(),
    mail: z.email(),
    gender: z.string(),
    phoneNumber: z.string(),
    instagram: z.string().optional(),
    birthDate: z.string(),
    ticketTypeId: z.uuid(),
    ticketGroupId: z.uuid(),
    eventId: z.uuid().nullable().optional(),
  })
  .array();

export const emittedTicketSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  age: z.number(),
  dni: z.string(),
  mail: z.string(),
  gender: z.string(),
  phoneNumber: z.string(),
  instagram: z.string(),
  birthDate: z.string(),
  paidOnLocation: z.boolean(),
});

export const emittedTicketsRouter = router({
  createMany: publicProcedure
    .input(createManyTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const values: z.infer<typeof createManyTicketFullSchema> = input.map(
        ({ id, ...rest }) => ({
          ...rest,
          age: 10,
          paidOnLocation: false,
          scannedByUserId: null,
        }),
      );
      const res = await ctx.db.insert(emittedTicket).values(values).returning();

      if (!res) throw 'Error al crear ticket/s';
      return res;
    }),
  generatePdfTicket: publicProcedure
    .input(z.uuid())
    .query(async ({ ctx, input }) => {
      try {
        const template = generateTicketTemplate();

        const inputs = [
          {
            eventName: 'Nombre evento ejemplo',
            eventDate: 'Domingo 2/2 11:30',
            eventLocation: 'Aca en mi casa ejemplo',
            fullName: 'nombre completo',
            dni: '43.333.333',
            seat: '-',
            barcode: encryptString('901e6b62-70f4-4e79-b67c-a73684e80d30'),
            footer: 'FOOTER',
            emissionDate: 'dd/MM/yyyy HH:mm',
          },
        ];
        console.log(template);
        const plugins = {
          text,
          line,
          image,
          barcodes: barcodes.qrcode,
        };

        const pdf = await generate({ template, inputs, plugins });

        const blob = new Blob([pdf.buffer as BlobPart], {
          type: 'application/pdf',
        });

        const response = Buffer.from(await blob.arrayBuffer()).toString(
          'base64',
        );

        return response;
      } catch (e) {
        console.log(e);
      }
    }),
});
