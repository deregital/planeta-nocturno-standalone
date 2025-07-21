import { db } from './index';
import { user } from './schema';
import { hash } from 'bcrypt';
import { eq } from 'drizzle-orm';

async function main() {
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
