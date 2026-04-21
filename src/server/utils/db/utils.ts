import { inArray, like, min, sql } from 'drizzle-orm';

import { type db as database } from '@/drizzle';

import { emittedTicket, event } from '@/drizzle/schema';
import { generateSlug, nextAvailableSlugInFamily } from '@/server/utils/utils';

export async function getUniqueEventSlug(
  db: typeof database,
  eventName: string,
): Promise<string> {
  const baseSlug = generateSlug(eventName);
  const familyRegex = new RegExp(`^${baseSlug}(?:-\\d+)?$`);

  const existingEvents = await db.query.event.findMany({
    where: like(event.slug, `${baseSlug}%`),
    columns: {
      slug: true,
    },
  });

  const occupiedFamilySlugs = existingEvents
    .map((event) => event.slug)
    .filter((slug) => familyRegex.test(slug));

  return nextAvailableSlugInFamily(baseSlug, occupiedFamilySlugs);
}

type TicketTypeSlugInput = {
  id: string;
  name: string;
  slug?: string | null;
};

export function getUniqueTicketTypeSlugsById(
  ticketTypes: TicketTypeSlugInput[],
): Map<string, string> {
  const uniqueSlugsById: Map<string, string> = new Map();

  for (const ticketType of ticketTypes) {
    const slug = ticketType.slug ?? generateSlug(ticketType.name);
    const baseSlug = generateSlug(ticketType.name);

    const pool: string[] = [
      ...uniqueSlugsById.values(),
      ...ticketTypes
        .filter((t) => t.id !== ticketType.id && !uniqueSlugsById.has(t.id))
        .map((t) => t.slug ?? generateSlug(t.name)),
    ];

    if (pool.includes(slug)) {
      uniqueSlugsById.set(
        ticketType.id,
        nextAvailableSlugInFamily(baseSlug, pool),
      );
    } else {
      uniqueSlugsById.set(ticketType.id, slug);
    }
  }

  return uniqueSlugsById;
}

export async function getBuyersCodeByDni(
  db: typeof database,
  dnis: string[],
): Promise<{ dni: string; id: number }[] | null> {
  if (dnis.length === 0) return null;

  const firstPurchaseDate = min(emittedTicket.createdAt).as('firstPurchase');

  // Primera CTE: agrupa por DNI y obtiene la primera fecha de compra
  const buyersWithDateCte = db
    .select({
      dni: emittedTicket.dni,
      firstPurchase: firstPurchaseDate,
    })
    .from(emittedTicket)
    .groupBy(emittedTicket.dni)
    .as('buyers_with_date');

  // Segunda CTE: calcula el ID único para TODOS los compradores (ordenados por primera compra)
  const allBuyersCte = db
    .select({
      dni: buyersWithDateCte.dni,
      id: sql<number>`ROW_NUMBER() OVER (ORDER BY ${buyersWithDateCte.firstPurchase} ASC)`.as(
        'id',
      ),
    })
    .from(buyersWithDateCte)
    .as('all_buyers');

  // Filtramos por los DNIs solicitados, manteniendo los IDs únicos globales
  const filteredBuyers = await db
    .with(buyersWithDateCte, allBuyersCte)
    .select({
      dni: allBuyersCte.dni,
      id: allBuyersCte.id,
    })
    .from(allBuyersCte)
    .where(inArray(allBuyersCte.dni, dnis));

  return filteredBuyers;
}
