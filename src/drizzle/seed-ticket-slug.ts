import 'dotenv/config';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

import * as relations from '@/drizzle/relations';
import * as models from '@/drizzle/schema';
import { emittedTicket } from '@/drizzle/schema';

const db = drizzle(process.env.DATABASE_URL!, {
  schema: { ...relations, ...models },
});

async function main() {
  // Get all ticket types that have emitted tickets
  const types = await db.query.ticketType.findMany();

  for (const type of types) {
    // Fetch name once
    const normalized = type.name.trim().toLowerCase().replace(/\s+/g, '-');

    // Count existing emitted tickets for this type, ordered by createdAt to get stable sequence
    const tickets = await db.query.emittedTicket.findMany({
      where: eq(emittedTicket.ticketTypeId, type.id),
      orderBy: asc(emittedTicket.createdAt),
    });

    if (tickets.length === 0) continue;

    // Build slugs sequentially based on their order
    let index = 0;
    for (const t of tickets) {
      index += 1;
      const slug = `${normalized}-${index}`;

      // Only update if missing or different
      if (!t.slug || t.slug !== slug) {
        await db
          .update(emittedTicket)
          .set({ slug })
          .where(eq(emittedTicket.id, t.id));
      }
    }
    console.log(
      `Updated ${tickets.length} emitted tickets for type '${type.name}'.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
