import { hash } from 'bcrypt';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

import { type InsertTicketType } from '@/server/types';
import * as relations from '@/drizzle/relations';
import * as models from '@/drizzle/schema';
import {
  event,
  eventCategory,
  location,
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

async function main() {
  // 1. Crear locación
  const locationName = 'Centro de Convenciones';
  let loc = await db.query.location.findFirst({
    where: eq(location.name, locationName),
  });
  if (!loc) {
    const [insertedLoc] = await db
      .insert(location)
      .values({
        name: locationName,
        address: 'Av. Siempre Viva 123',
        googleMapsUrl: 'https://maps.google.com/?q=Centro+de+Convenciones',
        capacity: 1000,
      })
      .returning();
    loc = insertedLoc;
    console.log('Locación creada');
  } else {
    console.log('Locación ya existe');
  }

  // 2. Crear categoría
  const categoryName = 'Concierto';
  let cat = await db.query.eventCategory.findFirst({
    where: eq(eventCategory.name, categoryName),
  });
  if (!cat) {
    const [insertedCat] = await db
      .insert(eventCategory)
      .values({
        name: categoryName,
      })
      .returning();
    cat = insertedCat;
    console.log('Categoría creada');
  } else {
    console.log('Categoría ya existe');
  }

  // 3. Crear evento
  const eventName = 'Noche de Rock';
  let ev = await db.query.event.findFirst({ where: eq(event.name, eventName) });
  if (!ev) {
    const [insertedEvent] = await db
      .insert(event)
      .values({
        name: eventName,
        description: 'Un concierto inolvidable de rock nacional.',
        coverImageUrl:
          'https://i1.sndcdn.com/artworks-6ynRG9wIT0n9MmI6-LmuH4Q-t500x500.jpg',
        slug: 'noche-de-rock',
        startingDate: new Date('2024-08-01T20:00:00Z').toISOString(),
        endingDate: new Date('2024-08-02T02:00:00Z').toISOString(),
        minAge: 18,
        locationId: loc.id,
        categoryId: cat.id,
      })
      .returning();
    ev = insertedEvent;
    console.log('Evento creado');
  } else {
    console.log('Evento ya existe');
  }

  // 4. Crear 3 tipos de tickets para el evento
  const ticketTypesData: InsertTicketType[] = [
    {
      name: 'General',
      description: 'Acceso general al evento',
      price: 5000,
      maxAvailable: 500,
      maxPerPurchase: 4,
      eventId: ev.id,
      category: 'PAID',
    },
    {
      name: 'VIP',
      description: 'Acceso VIP con beneficios exclusivos',
      price: 12000,
      maxAvailable: 100,
      maxPerPurchase: 2,
      eventId: ev.id,
      category: 'TABLE',
    },
    {
      name: 'Backstage',
      description: 'Acceso al backstage y meet & greet',
      price: 0,
      maxAvailable: 20,
      maxPerPurchase: 1,
      eventId: ev.id,
      category: 'FREE',
    },
  ];

  for (const t of ticketTypesData) {
    const exists = await db.query.ticketType.findFirst({
      where: eq(ticketType.name, t.name),
    });
    if (!exists) {
      await db.insert(ticketType).values(t);
      console.log(`Tipo de ticket '${t.name}' creado`);
    } else {
      console.log(`Tipo de ticket '${t.name}' ya existe`);
    }
  }

  // Usuario demo (como antes)
  const hashedPassword = await hash('123456', 10);
  const isCreated = await db.query.user.findFirst({
    where: eq(user.name, 'nico'),
  });
  if (isCreated) {
    console.log('Usuario nico ya existe');
    return;
  }
  await db.insert(user).values({
    name: 'nico',
    password: hashedPassword,
    email: 'nico@example.com',
    fullName: 'Nico Example',
    role: 'ADMIN',
    // createdAt, id y otros campos usan default
  });
  console.log('Usuario nico creado');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
