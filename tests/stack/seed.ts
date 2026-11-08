// Siembra el stack simulado: admin del panel de control, dos plataformas
// con usuarios de cada rol, eventos de cada tipo y entradas ya emitidas (con
// sus QR en PNG) para probar la puerta. Deja todo en .run/seed.json.
//   node --import tsx --import ./tests/load/register-phone-metadata.mjs tests/stack/seed.ts
import '@tests/load/bootstrap';

import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { hash } from 'bcrypt';
import { eq } from 'drizzle-orm';
import { Client, Pool } from 'pg';
import QRCode from 'qrcode';

import { createDb, type Db } from '@/drizzle';

import { getControlDb } from '@/db/control/client';
import { controlAdmins, controlRoles } from '@/db/control/schema';
import { SUPER_ADMIN_ROLE_NAME } from '@/lib/control/permissions';
import { SYSTEM_ACCESS_ROLE_IDS } from '@/lib/rbac/permissions';
import { loadUserAccess } from '@/server/rbac/access';
import { appRouter } from '@/server/routers/app';
import { setTransferAlias } from '@/server/services/paymentSettings';
import { updateTicketGroupStatus } from '@/server/services/ticketGroup';
import { migrateTenantDatabase } from '@/server/tenancy/migrate-tenant-database';
import {
  ensureTenantSuperadmin,
  getSuperadminCredentials,
} from '@/server/tenancy/superadmin';
import { createCallerFactory } from '@/server/trpc';

const createCaller = createCallerFactory(appRouter);
const PG_BASE = process.env.PG_BASE!;
const ROOT_DOMAIN = process.env.ROOT_DOMAIN!;
const RUN = process.env.STACK_RUN_DIR!;
const PASSWORD = process.env.STACK_USER_PASSWORD!;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const COVER =
  'https://planeta-nocturno.s3.us-east-1.amazonaws.com/seed/cover.png';

type Role = keyof typeof SYSTEM_ACCESS_ROLE_IDS;
type SeedUser = {
  username: string;
  role: Role;
  fullName: string;
  chief?: string;
};
type CreatedUser = SeedUser & { id: string; dni: string; email: string };
type TicketTypeInput = {
  name: string;
  price: number;
  maxAvailable: number;
  maxPerPurchase: number;
  category: 'FREE' | 'PAID' | 'TABLE';
  startingDate: Date;
  visibleInWeb?: boolean;
  lowStockThreshold?: number | null;
  allowMultipleScans?: boolean;
};

let dniSeq = 0;

function instanceFor(
  slug: string,
  name: string,
  tenantId: number,
  databaseName: string,
  mp: string | null,
): ResolvedInstance {
  const url = `https://${slug}.${ROOT_DOMAIN}`;
  return {
    tenantId,
    slug,
    name,
    publicUrl: url,
    siteUrl: url,
    contactEmail: `contacto@${slug}.pn.test`,
    description: null,
    faviconUrl: null,
    hue: 265,
    saturation: 80,
    mercadoPagoAccessToken: mp,
    mercadoPagoRefreshToken: null,
    database: { name: databaseName },
  };
}

function callerFor(db: Db, instance: ResolvedInstance, user: CreatedUser) {
  let access: ReturnType<typeof loadUserAccess> | undefined;
  return createCaller({
    db,
    instance,
    session: {
      expires: new Date(Date.now() + DAY).toISOString(),
      user: {
        id: user.id,
        role: user.role,
        name: user.username,
        email: user.email,
        fullName: user.fullName,
        tenantSlug: instance.slug,
        emailVerified: null,
        image: null,
      },
    },
    headers: new Headers(),
    getAccess: () => (access ??= loadUserAccess(db, user.id)),
  } as never);
}

async function insertUsers(raw: Pool, slug: string, users: SeedUser[]) {
  const created = new Map<string, CreatedUser>();
  const passwordHash = await hash(PASSWORD, 10);
  for (const seed of users) {
    const id = randomUUID();
    const dni = String(20_000_000 + (dniSeq += 1));
    const email = `${seed.username}@${slug}.pn.test`;
    await raw.query(
      `INSERT INTO "user" (id, name, "fullName", password, email, "birthDate", dni,
         "phoneNumber", gender, role, "chiefOrganizerId", "accessRoleId")
       VALUES ($1, $2, $3, $4, $5, '1992-03-14', $6, '+5491155550101', 'other', $7, $8, $9)`,
      [
        id,
        seed.username,
        seed.fullName,
        passwordHash,
        email,
        dni,
        seed.role,
        seed.chief ? created.get(seed.chief)!.id : null,
        SYSTEM_ACCESS_ROLE_IDS[seed.role],
      ],
    );
    created.set(seed.username, { ...seed, id, dni, email });
  }
  return created;
}

function ticketType(input: TicketTypeInput) {
  return {
    id: randomUUID(),
    description: `Entrada ${input.name}`,
    maxSellDate: null,
    scanLimit: null,
    visibleInWeb: true,
    lowStockThreshold: null,
    allowMultipleScans: false,
    ...input,
  };
}

function organizerTicketType(startingDate: Date) {
  return ticketType({
    name: 'Organizador',
    price: 0,
    maxAvailable: 1,
    maxPerPurchase: 1,
    category: 'FREE',
    startingDate,
    visibleInWeb: false,
  });
}

function eventInput(
  name: string,
  startingDate: Date,
  overrides: Record<string, unknown> = {},
) {
  return {
    name,
    description: `${name}. Evento sembrado para el stack de pruebas.`,
    coverImageUrl: COVER,
    videoUrl: null,
    startingDate,
    endingDate: new Date(startingDate.getTime() + 8 * HOUR),
    minAge: 18,
    isActive: true,
    locationId: null,
    categoryId: null,
    authorizedUsers: [] as { id: string; name: string }[],
    inviteCondition: 'TRADITIONAL' as const,
    extraTicketData: false,
    serviceFee: null,
    emailNotification: null,
    ticketSlugVisibleInPdf: false,
    hasSimpleInvitation: false,
    descriptionTitleVisible: true,
    ...overrides,
  };
}

let buyerSeq = 0;
function buyer(
  ticketTypeId: string,
  ticketGroupId: string,
  eventId: string,
  label: string,
) {
  buyerSeq += 1;
  return {
    fullName: `${label} ${String(buyerSeq).padStart(3, '0')}`,
    dni: String(40_000_000 + buyerSeq),
    mail: `comprador${buyerSeq}@compradores.pn.test`,
    gender: buyerSeq % 2 ? 'female' : 'male',
    phoneNumber: '+5491155550000',
    instagram: '',
    birthDate: new Date('1998-05-10'),
    paidOnLocation: false,
    ticketTypeId,
    ticketGroupId,
    eventId,
  };
}

type Caller = ReturnType<typeof callerFor>;

async function sell(
  caller: Caller,
  db: Db,
  eventId: string,
  ticketTypeId: string,
  amount: number,
  status: 'PAID' | 'FREE',
  label: string,
) {
  const groupId = await caller.ticketGroup.create({
    eventId,
    ticketsPerType: [{ ticketTypeId, amount }],
    invitedBy: null,
  });
  await caller.emittedTickets.createMany(
    Array.from({ length: amount }, () =>
      buyer(ticketTypeId, groupId, eventId, label),
    ),
  );
  await updateTicketGroupStatus(db, groupId, status);
  return groupId;
}

async function redeemAll(
  caller: Caller,
  db: Db,
  raw: Pool,
  eventId: string,
  ticketTypeId: string,
  label: string,
) {
  const { rows } = await raw.query<{ code: string }>(
    `SELECT code FROM "ticketXOrganizer" WHERE "eventId" = $1 AND "ticketId" IS NULL ORDER BY "shortId"`,
    [eventId],
  );
  const groups: string[] = [];
  for (const { code } of rows) {
    const redeemed = await caller.ticketGroup.redeemInvitation({
      eventId,
      code,
    });
    if (redeemed.status !== 'ok')
      throw new Error(`Código ${code}: ${redeemed.status}`);
    await caller.emittedTickets.createMany([
      buyer(ticketTypeId, redeemed.ticketGroupId, eventId, label),
    ]);
    await updateTicketGroupStatus(db, redeemed.ticketGroupId, 'FREE');
    groups.push(redeemed.ticketGroupId);
  }
  return groups;
}

/** Renderiza el PDF de cada entrada y lo deja como PNG para la cámara falsa. */
async function exportQrs(
  caller: Caller,
  raw: Pool,
  eventId: string,
  dir: string,
) {
  mkdirSync(dir, { recursive: true });
  const { rows } = await raw.query<{
    id: string;
    ticketGroupId: string;
    fullName: string;
  }>(
    `SELECT id, "ticketGroupId", "fullName" FROM "emittedTicket" WHERE "eventId" = $1 ORDER BY "shortId"`,
    [eventId],
  );
  const files: { file: string; fullName: string; emittedTicketId: string }[] =
    [];
  for (const [index, ticket] of rows.entries()) {
    const { base64 } = await caller.ticketGroup.getPdfByEmittedTicketId({
      ticketGroupId: ticket.ticketGroupId,
      emittedTicketId: ticket.id,
    });
    const base = path.join(dir, String(index + 1).padStart(2, '0'));
    writeFileSync(`${base}.pdf`, Buffer.from(base64, 'base64'));
    execFileSync('pdftoppm', [
      '-png',
      '-r',
      '110',
      '-singlefile',
      `${base}.pdf`,
      base,
    ]);
    files.push({
      file: `${base}.png`,
      fullName: ticket.fullName,
      emittedTicketId: ticket.id,
    });
  }
  return files;
}

async function seedControlAdmin() {
  const db = getControlDb();
  const [role] = await db
    .select({ id: controlRoles.id })
    .from(controlRoles)
    .where(eq(controlRoles.name, SUPER_ADMIN_ROLE_NAME))
    .limit(1);
  await db
    .insert(controlAdmins)
    .values({
      username: process.env.CONTROL_BOOTSTRAP_USERNAME!,
      email: process.env.CONTROL_BOOTSTRAP_EMAIL!,
      password: await hash(process.env.CONTROL_BOOTSTRAP_PASSWORD!, 10),
      roleId: role!.id,
    })
    .onConflictDoNothing();
}

async function createTenant(
  control: Client,
  slug: string,
  name: string,
  databaseName: string,
  mp: string | null,
) {
  await control.query(`CREATE DATABASE "${databaseName}"`).catch(() => {});
  const { rows } = await control.query<{ id: number }>(
    `INSERT INTO tenants (slug, name, hue, saturation, contact_email, database_name, status, mp_access_token, mp_access_token_expires_at)
     VALUES ($1, $2, 265, 80, $3, $4, 'active', $5, $6)
     ON CONFLICT (slug) DO UPDATE SET status = 'active'
     RETURNING id`,
    [
      slug,
      name,
      `contacto@${slug}.pn.test`,
      databaseName,
      mp,
      mp ? new Date(Date.now() + 180 * DAY) : null,
    ],
  );
  const url = `${PG_BASE}/${databaseName}`;
  await migrateTenantDatabase(url);
  const raw = new Pool({ connectionString: url, max: 4 });
  const db = createDb(url, { max: 4 });
  await ensureTenantSuperadmin(db as never, getSuperadminCredentials());
  return {
    tenantId: rows[0].id,
    raw,
    db,
    instance: instanceFor(slug, name, rows[0].id, databaseName, mp),
  };
}

async function seedPrueba(control: Client) {
  const { raw, db, instance } = await createTenant(
    control,
    'prueba',
    'Prueba Producciones',
    'tenant_1_prueba',
    'APP_USR-stack-fake-token',
  );
  const users = await insertUsers(raw, 'prueba', [
    { username: 'admin', role: 'ADMIN', fullName: 'Ana Admin' },
    { username: 'admin2', role: 'ADMIN', fullName: 'Beto Admin' },
    { username: 'boleteria', role: 'TICKETING', fullName: 'Carla Boletería' },
    { username: 'puerta', role: 'CONTROL_TICKETING', fullName: 'Diego Puerta' },
    { username: 'puerta2', role: 'CONTROL_TICKETING', fullName: 'Eva Puerta' },
    { username: 'jefe', role: 'CHIEF_ORGANIZER', fullName: 'Fede Jefe' },
    {
      username: 'orga1',
      role: 'ORGANIZER',
      fullName: 'Gabi Organiza',
      chief: 'jefe',
    },
    {
      username: 'orga2',
      role: 'ORGANIZER',
      fullName: 'Hugo Organiza',
      chief: 'jefe',
    },
    { username: 'orga3', role: 'ORGANIZER', fullName: 'Inés Independiente' },
  ]);
  const u = (name: string) => users.get(name)!;
  const admin = callerFor(db, instance, u('admin'));
  const org = (name: string, extra: Record<string, unknown>) => ({
    id: u(name).id,
    dni: u(name).dni,
    fullName: u(name).fullName,
    phoneNumber: '+5491155550101',
    role: u(name).role,
    ...extra,
  });
  const staff = [u('puerta'), u('puerta2'), u('boleteria')].map((user) => ({
    id: user.id,
    name: user.fullName,
  }));
  const events: Record<string, unknown>[] = [];
  const create = async (
    key: string,
    input: Parameters<Caller['events']['create']>[0],
    notes: string,
  ) => {
    const { eventCreated } = await admin.events.create(input);
    const full = await admin.events.getById(eventCreated.id);
    const entry = {
      key,
      id: eventCreated.id,
      slug: eventCreated.slug,
      name: full.name,
      inviteCondition: full.inviteCondition,
      notes,
      ticketTypes: full.ticketTypes.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        maxAvailable: t.maxAvailable,
      })),
    };
    events.push(entry);
    return full;
  };

  const inTenDays = new Date(Date.now() + 10 * DAY);
  const paga = await create(
    'fiesta-paga',
    {
      event: eventInput('Fiesta Paga de Prueba', inTenDays, {
        serviceFee: 10,
        authorizedUsers: staff,
        emailNotification: 'avisos@prueba.pn.test',
      }),
      ticketTypes: [
        ticketType({
          name: 'General',
          price: 5000,
          maxAvailable: 300,
          maxPerPurchase: 6,
          category: 'PAID',
          startingDate: inTenDays,
        }),
        ticketType({
          name: 'VIP',
          price: 15000,
          maxAvailable: 30,
          maxPerPurchase: 4,
          category: 'PAID',
          startingDate: inTenDays,
          lowStockThreshold: 10,
        }),
        ticketType({
          name: 'Lista free',
          price: 0,
          maxAvailable: 40,
          maxPerPurchase: 2,
          category: 'FREE',
          startingDate: inTenDays,
        }),
        ticketType({
          name: 'Mesa 6 personas',
          price: 60000,
          maxAvailable: 5,
          maxPerPurchase: 1,
          category: 'TABLE',
          startingDate: inTenDays,
        }),
        organizerTicketType(inTenDays),
      ],
      organizersInput: [
        org('orga1', { type: 'TRADITIONAL', discountPercentage: 20 }),
        org('orga3', { type: 'TRADITIONAL', discountPercentage: null }),
      ] as never,
      sendOrganizerTicketEmail: false,
      questions: [
        { text: '¿Cómo te enteraste de la fiesta?', isRequired: true },
        { text: '¿Alguna alergia o restricción?', isRequired: false },
      ],
    },
    'TRADITIONAL pago por Mercado Pago (simulado), 10% de cargo por servicio, preguntas, links de organizador (?organizer=) con 20% de descuento para orga1',
  );
  const general = paga.ticketTypes.find((t) => t.name === 'General')!;
  for (let i = 0; i < 12; i += 1)
    await sell(
      admin,
      db,
      paga.id,
      general.id,
      1 + (i % 3),
      'PAID',
      'Comprador',
    );

  await create(
    'ultimas-entradas',
    {
      event: eventInput('Últimas 3 Entradas', inTenDays),
      ticketTypes: [
        ticketType({
          name: 'Anticipada',
          price: 3000,
          maxAvailable: 3,
          maxPerPurchase: 2,
          category: 'PAID',
          startingDate: inTenDays,
        }),
      ],
      organizersInput: [],
      sendOrganizerTicketEmail: false,
      questions: [],
    },
    'Sólo 3 entradas pagas, máximo 2 por compra: sirve para probar compras simultáneas del último cupo',
  );

  await create(
    'gratis',
    {
      event: eventInput(
        'Fiesta Gratis con Datos Extra',
        new Date(Date.now() + 5 * DAY),
        { extraTicketData: true, minAge: null },
      ),
      ticketTypes: [
        ticketType({
          name: 'Entrada libre',
          price: 0,
          maxAvailable: 100,
          maxPerPurchase: 4,
          category: 'FREE',
          startingDate: new Date(Date.now() + 5 * DAY),
        }),
      ],
      organizersInput: [],
      sendOrganizerTicketEmail: false,
      questions: [{ text: 'Instagram de quien te invitó', isRequired: false }],
    },
    'Gratis, pide datos de cada entrada (extraTicketData): las entradas llegan por mail al instante',
  );

  const egresados = await create(
    'egresados',
    {
      event: eventInput(
        'Egresados por Invitación',
        new Date(Date.now() + 7 * DAY),
        { inviteCondition: 'INVITATION', isActive: false },
      ),
      ticketTypes: [
        ticketType({
          name: 'Invitación',
          price: 0,
          maxAvailable: 120,
          maxPerPurchase: 1,
          category: 'FREE',
          startingDate: new Date(Date.now() + 7 * DAY),
        }),
        organizerTicketType(new Date(Date.now() + 7 * DAY)),
      ],
      organizersInput: [
        org('jefe', { type: 'INVITATION', ticketAmount: 60 }),
        org('orga1', { type: 'INVITATION', ticketAmount: 20 }),
        org('orga3', { type: 'INVITATION', ticketAmount: 20 }),
      ] as never,
      sendOrganizerTicketEmail: false,
      questions: [],
    },
    'INVITATION: el jefe tiene 60 invitaciones para repartir en su equipo (orga1, orga2), orga1 20 y orga3 20. Los códigos se canjean en /api/event/<slug>/invite?invite=CODE',
  );
  const { rows: inviteRows } = await raw.query<{
    code: string;
    organizer: string;
  }>(
    `SELECT t.code, u.name AS organizer FROM "ticketXOrganizer" t JOIN "user" u ON u.id = t."organizerId"
     WHERE t."eventId" = $1 ORDER BY u.name, t."shortId"`,
    [egresados.id],
  );

  const started = new Date(Date.now() - HOUR);
  const enCurso = await create(
    'en-curso',
    {
      event: eventInput('Fiesta En Curso (puerta)', started, {
        authorizedUsers: staff,
        endingDate: new Date(Date.now() + 10 * HOUR),
        inviteCondition: 'INVITATION',
        isActive: false,
      }),
      ticketTypes: [
        ticketType({
          name: 'Invitación',
          price: 0,
          maxAvailable: 40,
          maxPerPurchase: 1,
          category: 'FREE',
          startingDate: started,
        }),
        organizerTicketType(started),
      ],
      organizersInput: [
        org('orga3', { type: 'INVITATION', ticketAmount: 40 }),
      ] as never,
      sendOrganizerTicketEmail: false,
      questions: [],
    },
    'Empezó hace una hora: 40 entradas emitidas para escanear en /admin/event/<slug>/scan (QR en qr/en-curso/*.png)',
  );
  const invitacion = enCurso.ticketTypes.find((t) => t.name === 'Invitación')!;
  await redeemAll(admin, db, raw, enCurso.id, invitacion.id, 'Invitado');
  const qrEnCurso = await exportQrs(
    admin,
    raw,
    enCurso.id,
    path.join(RUN, 'qr', 'en-curso'),
  );

  const later = new Date(Date.now() + 3 * HOUR);
  const masTarde = await create(
    'mas-tarde',
    {
      event: eventInput('Fiesta Más Tarde', later, { authorizedUsers: staff }),
      ticketTypes: [
        ticketType({
          name: 'General',
          price: 0,
          maxAvailable: 20,
          maxPerPurchase: 2,
          category: 'FREE',
          startingDate: later,
        }),
      ],
      organizersInput: [],
      sendOrganizerTicketEmail: false,
      questions: [],
    },
    'Empieza en 3 horas: sus QR no deberían entrar todavía (qr/mas-tarde/*.png)',
  );
  await sell(
    admin,
    db,
    masTarde.id,
    masTarde.ticketTypes[0].id,
    2,
    'FREE',
    'Temprano',
  );
  const qrMasTarde = await exportQrs(
    admin,
    raw,
    masTarde.id,
    path.join(RUN, 'qr', 'mas-tarde'),
  );

  const yesterday = new Date(Date.now() - 2 * DAY);
  const pasado = await create(
    'pasado',
    {
      event: eventInput('Evento Pasado', yesterday),
      ticketTypes: [
        ticketType({
          name: 'General',
          price: 2000,
          maxAvailable: 50,
          maxPerPurchase: 4,
          category: 'PAID',
          startingDate: yesterday,
        }),
      ],
      organizersInput: [],
      sendOrganizerTicketEmail: false,
      questions: [],
    },
    'Terminó hace más de un día, con ventas',
  );
  // La app ya no vende entradas de un evento terminado: se venden con el evento
  // abierto y después se lo corre al pasado, como pasaría en la realidad.
  const pasadoEnding = new Date(yesterday.getTime() + 8 * HOUR).toISOString();
  await raw.query(
    `UPDATE event SET "endingDate" = now() + interval '1 day' WHERE id = $1`,
    [pasado.id],
  );
  await sell(
    admin,
    db,
    pasado.id,
    pasado.ticketTypes[0].id,
    3,
    'PAID',
    'Histórico',
  );
  await raw.query(`UPDATE event SET "endingDate" = $2 WHERE id = $1`, [
    pasado.id,
    pasadoEnding,
  ]);

  await create(
    'borrador',
    {
      event: eventInput('Evento Borrador Inactivo', inTenDays, {
        isActive: false,
      }),
      ticketTypes: [
        ticketType({
          name: 'General',
          price: 4000,
          maxAvailable: 100,
          maxPerPurchase: 4,
          category: 'PAID',
          startingDate: inTenDays,
        }),
      ],
      organizersInput: [],
      sendOrganizerTicketEmail: false,
      questions: [],
    },
    'Desactivado: no debería verse ni poder comprarse desde la web pública',
  );

  await create(
    'simple',
    {
      event: eventInput('Cumple Simple', new Date(Date.now() + 3 * DAY), {
        inviteCondition: 'SIMPLE',
        hasSimpleInvitation: true,
      }),
      ticketTypes: [
        ticketType({
          name: 'Invitado',
          price: 0,
          maxAvailable: 60,
          maxPerPurchase: 3,
          category: 'FREE',
          startingDate: new Date(Date.now() + 3 * DAY),
        }),
      ],
      organizersInput: [],
      sendOrganizerTicketEmail: false,
      questions: [],
    },
    'Evento SIMPLE con "invitado por" de texto libre',
  );

  await raw.end();
  await db.$client.end();
  return {
    url: instance.publicUrl,
    mercadoPago: 'simulado (checkout en https://mercadopago.mock.test)',
    users: [...users.values()].map(({ username, role, fullName, email }) => ({
      username,
      role,
      fullName,
      email,
    })),
    events,
    invitationCodes: inviteRows,
    qr: { enCurso: qrEnCurso, masTarde: qrMasTarde },
  };
}

async function seedOtra(control: Client) {
  const { raw, db, instance } = await createTenant(
    control,
    'otra',
    'Otra Productora',
    'tenant_2_otra',
    null,
  );
  await setTransferAlias(db, 'otra.productora.mp');
  const users = await insertUsers(raw, 'otra', [
    { username: 'admin', role: 'ADMIN', fullName: 'Olga Admin Otra' },
    {
      username: 'puerta',
      role: 'CONTROL_TICKETING',
      fullName: 'Pablo Puerta Otra',
    },
  ]);
  const admin = callerFor(db, instance, users.get('admin')!);
  const started = new Date(Date.now() - HOUR);
  const { eventCreated } = await admin.events.create({
    event: eventInput('Fiesta de Otra Productora', started, {
      endingDate: new Date(Date.now() + 10 * HOUR),
    }),
    ticketTypes: [
      ticketType({
        name: 'General',
        price: 2500,
        maxAvailable: 100,
        maxPerPurchase: 4,
        category: 'PAID',
        startingDate: started,
      }),
    ],
    organizersInput: [],
    sendOrganizerTicketEmail: false,
    questions: [],
  });
  const event = await admin.events.getById(eventCreated.id);
  await sell(admin, db, event.id, event.ticketTypes[0].id, 3, 'PAID', 'Ajeno');
  const qr = await exportQrs(
    admin,
    raw,
    event.id,
    path.join(RUN, 'qr', 'otra'),
  );
  await raw.end();
  await db.$client.end();
  return {
    url: instance.publicUrl,
    mercadoPago:
      'sin Mercado Pago: paga por transferencia al alias otra.productora.mp',
    users: [...users.values()].map(({ username, role, fullName, email }) => ({
      username,
      role,
      fullName,
      email,
    })),
    events: [
      {
        key: 'otra-en-curso',
        id: event.id,
        slug: event.slug,
        name: event.name,
        notes: 'Pago por transferencia, empezó hace una hora',
      },
    ],
    qr: { otra: qr },
  };
}

async function main() {
  await seedControlAdmin();
  const control = new Client({
    connectionString: process.env.CONTROL_DATABASE_URL,
  });
  await control.connect();
  try {
    const prueba = await seedPrueba(control);
    const otra = await seedOtra(control);
    const junk = path.join(RUN, 'qr', 'basura.png');
    await QRCode.toFile(junk, 'https://example.com/esto-no-es-una-entrada', {
      width: 600,
    });
    const seed = {
      createdAt: new Date().toISOString(),
      password: PASSWORD,
      note: 'Todos los usuarios de las plataformas usan la misma contraseña (campo password).',
      control: {
        url: `https://admin.${ROOT_DOMAIN}`,
        username: process.env.CONTROL_BOOTSTRAP_USERNAME,
        password: process.env.CONTROL_BOOTSTRAP_PASSWORD,
      },
      mailbox: 'https://mail.mock.test',
      tenants: { prueba, otra },
      junkQr: junk,
    };
    writeFileSync(path.join(RUN, 'seed.json'), JSON.stringify(seed, null, 2), {
      mode: 0o600,
    });
    console.log('seed listo');
  } finally {
    await control.end();
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
