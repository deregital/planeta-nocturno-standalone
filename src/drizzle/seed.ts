import { hash } from 'bcrypt';
import { drizzle } from 'drizzle-orm/node-postgres';

import * as relations from '@/drizzle/relations';
import * as models from '@/drizzle/schema';
import { user } from '@/drizzle/schema';
import 'dotenv/config';

export const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    ...relations,
    ...models,
  },
});

async function main() {
  // Leer parámetros de variables de entorno
  const userName = process.env.SEED_USER_NAME;
  if (!userName) throw new Error('SEED_USER_NAME is not set');
  const userPassword = process.env.SEED_USER_PASSWORD;
  if (!userPassword) throw new Error('SEED_USER_PASSWORD is not set');
  const userEmail = process.env.SEED_USER_EMAIL;
  if (!userEmail) throw new Error('SEED_USER_EMAIL is not set');
  const userFullName = process.env.SEED_USER_FULLNAME;
  if (!userFullName) throw new Error('SEED_USER_FULLNAME is not set');

  // Hash de la contraseña
  const hashedPassword = await hash(userPassword, 10);

  await db.insert(user).values({
    name: userName,
    password: hashedPassword,
    email: userEmail,
    fullName: userFullName,
    role: 'ADMIN',
    dni: '99999999',
    birthDate: '2000-01-01',
    gender: 'male',
    phoneNumber: '+5491138639833',
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
