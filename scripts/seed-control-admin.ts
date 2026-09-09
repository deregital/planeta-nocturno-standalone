import 'dotenv/config';

import { hash } from 'bcrypt';
import { eq } from 'drizzle-orm';

import { getControlDb } from '@/db/control/client';
import { controlAdmins, controlRoles } from '@/db/control/schema';
import { SUPER_ADMIN_ROLE_NAME } from '@/lib/control/permissions';

async function main() {
  const username = required('CONTROL_BOOTSTRAP_USERNAME');
  const email = required('CONTROL_BOOTSTRAP_EMAIL');
  const password = required('CONTROL_BOOTSTRAP_PASSWORD');

  const db = getControlDb();

  const [existingAdmins] = await db
    .select({ id: controlAdmins.id })
    .from(controlAdmins)
    .limit(1);

  if (existingAdmins) {
    console.log('control_admins already has users; bootstrap skipped');
    return;
  }

  const [superAdminRole] = await db
    .select({ id: controlRoles.id })
    .from(controlRoles)
    .where(eq(controlRoles.name, SUPER_ADMIN_ROLE_NAME))
    .limit(1);

  if (!superAdminRole) {
    throw new Error(
      `Role ${SUPER_ADMIN_ROLE_NAME} not found. Run npm run control:migrate first.`,
    );
  }

  const [admin] = await db
    .insert(controlAdmins)
    .values({
      username,
      email,
      password: await hash(password, 10),
      roleId: superAdminRole.id,
    })
    .returning({ id: controlAdmins.id, username: controlAdmins.username });

  console.log(`Created control admin: ${admin?.username} (${admin?.id})`);
}

function required(key: string) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
