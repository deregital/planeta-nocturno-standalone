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
  // Leer parámetros de variables de entorno
  const userName = process.env.SEED_USER_NAME || 'nico';
  const userPassword = process.env.SEED_USER_PASSWORD || 'defaultPassword123';
  const userEmail = process.env.SEED_USER_EMAIL || 'nico@example.com';
  const userFullName = process.env.SEED_USER_FULLNAME || 'Nico Example';

  // Hash de la contraseña
  const hashedPassword = await hash(userPassword, 10);

  await db.insert(user).values({
    name: userName,
    password: hashedPassword,
    email: userEmail,
    fullName: userFullName,
    role: 'ADMIN',
    // createdAt, id y otros campos usan default
  });

  console.log('Usuario creado exitosamente:');
  console.log(`  - Nombre: ${userName}`);
  console.log(`  - Email: ${userEmail}`);
  console.log(`  - Nombre completo: ${userFullName}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
