import { hash } from 'bcrypt';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

import * as relations from '@/drizzle/relations';
import * as models from '@/drizzle/schema';
import {
  emittedTicket,
  event,
  eventCategory,
  eventQuestion,
  location,
  ticketGroup,
  ticketGroupAnswer,
  ticketType,
  user,
} from '@/drizzle/schema';
import 'dotenv/config';

export const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    ...relations,
    ...models,
  },
});

const EVENT_SLUG = 'fiesta-de-bienvenida';

function daysFromNow(days: number, hours = 23, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

async function seedExtraUsers() {
  const defaultPassword = await hash('123456', 10);

  await db
    .insert(user)
    .values([
      {
        name: 'boleteria',
        password: defaultPassword,
        email: 'boleteria@localtickets.com',
        fullName: 'Usuario Boletería',
        role: 'TICKETING',
        dni: '40000001',
        birthDate: '1998-05-12',
        gender: 'female',
        phoneNumber: '+5491140000001',
      },
      {
        name: 'organizador1',
        password: defaultPassword,
        email: 'organizador1@localtickets.com',
        fullName: 'Juan Pérez',
        role: 'ORGANIZER',
        dni: '40000002',
        birthDate: '1995-09-03',
        gender: 'male',
        phoneNumber: '+5491140000002',
      },
      {
        name: 'organizador2',
        password: defaultPassword,
        email: 'organizador2@localtickets.com',
        fullName: 'María Gómez',
        role: 'ORGANIZER',
        dni: '40000003',
        birthDate: '1997-12-20',
        gender: 'female',
        phoneNumber: '+5491140000003',
      },
    ])
    .onConflictDoNothing();

  console.log('Usuarios extra creados: boleteria, organizador1, organizador2');
}

async function seedLocations() {
  const locations = await db
    .insert(location)
    .values([
      {
        name: 'Club Nocturno Central',
        address: 'Av. Corrientes 1234, CABA',
        googleMapsUrl: 'https://maps.google.com/?q=Av.+Corrientes+1234',
        capacity: 500,
      },
      {
        name: 'Terraza del Río',
        address: 'Av. Costanera 500, CABA',
        googleMapsUrl: 'https://maps.google.com/?q=Av.+Costanera+500',
        capacity: 300,
      },
    ])
    .returning();

  console.log(`Locations creadas: ${locations.length}`);
  return locations;
}

async function seedCategories() {
  const categories = await db
    .insert(eventCategory)
    .values([
      { name: 'Fiesta' },
      { name: 'Recital' },
      { name: 'Evento privado' },
    ])
    .returning();

  console.log(`Categorías creadas: ${categories.length}`);
  return categories;
}

async function seedEvent(locationId: string, categoryId: string) {
  const [createdEvent] = await db
    .insert(event)
    .values({
      name: 'Fiesta de Bienvenida',
      description:
        'Una noche inolvidable para arrancar la temporada. Música en vivo, DJs y mucho más.',
      coverImageUrl:
        'https://planeta-nocturno.s3.us-east-1.amazonaws.com/favicons/demo-tickets.png',
      slug: EVENT_SLUG,
      startingDate: daysFromNow(7, 23, 0),
      endingDate: daysFromNow(8, 6, 0),
      minAge: 18,
      isActive: true,
      locationId,
      categoryId,
      inviteCondition: 'TRADITIONAL',
      extraTicketData: true,
      hasSimpleInvitation: false,
      ticketSlugVisibleInPdf: false,
    })
    .returning();

  console.log(`Evento creado: ${createdEvent.name} (/${createdEvent.slug})`);

  const ticketTypes = await db
    .insert(ticketType)
    .values([
      {
        name: 'Entrada General',
        description: 'Acceso general al evento',
        price: null,
        maxAvailable: 200,
        maxPerPurchase: 4,
        category: 'FREE',
        startingDate: daysFromNow(0),
        maxSellDate: daysFromNow(7, 22, 0),
        slug: 'general',
        sortOrder: 1,
        eventId: createdEvent.id,
      },
      {
        name: 'Entrada VIP',
        description: 'Acceso VIP con barra libre',
        price: 15000,
        maxAvailable: 80,
        maxPerPurchase: 4,
        category: 'PAID',
        startingDate: daysFromNow(0),
        maxSellDate: daysFromNow(7, 22, 0),
        slug: 'vip',
        sortOrder: 2,
        eventId: createdEvent.id,
      },
      {
        name: 'Mesa',
        description: 'Mesa para 6 personas con servicio',
        price: 90000,
        maxAvailable: 20,
        maxPerPurchase: 1,
        category: 'TABLE',
        startingDate: daysFromNow(0),
        maxSellDate: daysFromNow(7, 22, 0),
        slug: 'mesa',
        sortOrder: 3,
        eventId: createdEvent.id,
      },
    ])
    .returning();

  console.log(`Tipos de ticket creados: ${ticketTypes.length}`);

  const questions = await db
    .insert(eventQuestion)
    .values([
      {
        text: '¿Cómo te enteraste del evento?',
        sortOrder: 0,
        eventId: createdEvent.id,
      },
      {
        text: '¿Tenés alguna restricción alimentaria?',
        sortOrder: 1,
        eventId: createdEvent.id,
      },
    ])
    .returning();

  console.log(`Preguntas del formulario creadas: ${questions.length}`);

  return { createdEvent, ticketTypes, questions };
}

async function seedSamplePurchase({
  eventId,
  generalTicketTypeId,
  questions,
}: {
  eventId: string;
  generalTicketTypeId: string;
  questions: { id: string }[];
}) {
  const [group] = await db
    .insert(ticketGroup)
    .values({
      status: 'FREE',
      amountTickets: 2,
      eventId,
    })
    .returning();

  await db.insert(emittedTicket).values([
    {
      fullName: 'Lucía Fernández',
      dni: '41222333',
      mail: 'lucia@example.com',
      gender: 'female',
      phoneNumber: '+5491155551111',
      instagram: '@luciaf',
      birthDate: '2000-03-15',
      slug: 'general-1',
      ticketTypeId: generalTicketTypeId,
      ticketGroupId: group.id,
      eventId,
    },
    {
      fullName: 'Pedro Sánchez',
      dni: '41222444',
      mail: 'pedro@example.com',
      gender: 'male',
      phoneNumber: '+5491155552222',
      instagram: null,
      birthDate: '1999-07-22',
      slug: 'general-2',
      ticketTypeId: generalTicketTypeId,
      ticketGroupId: group.id,
      eventId,
    },
  ]);

  if (questions.length >= 2) {
    await db.insert(ticketGroupAnswer).values([
      {
        questionId: questions[0].id,
        ticketGroupId: group.id,
        answer: 'Por Instagram',
      },
      {
        questionId: questions[1].id,
        ticketGroupId: group.id,
        answer: 'Vegetariana',
      },
    ]);
  }

  console.log('Compra de ejemplo creada con respuestas al formulario');
}

async function main() {
  const existingEvent = await db.query.event.findFirst({
    where: eq(event.slug, EVENT_SLUG),
  });

  if (existingEvent) {
    console.log(
      `El evento de ejemplo "${EVENT_SLUG}" ya existe, se omite la creación de datos de ejemplo.`,
    );
    return;
  }

  await seedExtraUsers();
  const locations = await seedLocations();
  const categories = await seedCategories();

  const { createdEvent, ticketTypes, questions } = await seedEvent(
    locations[0].id,
    categories[0].id,
  );

  const generalTicketType = ticketTypes.find((t) => t.slug === 'general');

  if (generalTicketType) {
    await seedSamplePurchase({
      eventId: createdEvent.id,
      generalTicketTypeId: generalTicketType.id,
      questions,
    });
  }

  console.log('\nSeed de evento completado con éxito.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
