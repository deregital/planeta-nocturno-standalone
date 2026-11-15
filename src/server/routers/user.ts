import { TRPCError } from '@trpc/server';
import { hash } from 'bcrypt';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { Db } from '@/drizzle';

import { tag as tagTable, user as userTable, userXTag } from '@/drizzle/schema';
import { resetPasswordSchema, userSchema } from '@/server/schemas/user';
import { genderSchema } from '@/server/schemas/utils';
import {
  generateWelcomeEmail,
  sendMailWithoutAttachments,
} from '@/server/services/mail';
import { SYSTEM_ACCESS_ROLE_IDS } from '@/lib/rbac/permissions';
import {
  getRoleIdsWithPermission,
  isHiddenUser,
  visibleUserCondition,
} from '@/server/rbac/access';
import { assertCanAccessOrganizer } from '@/server/rbac/scope';
import {
  assertCanAssignRole,
  assertCanManageUser,
} from '@/server/rbac/user-assignment';
import {
  anyPermissionProcedure,
  forbidden,
  permissionProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from '@/server/trpc';
import { type Tag, type User } from '@/server/types';
import {
  buildUserXTagsRelation,
  getTagIdsOwnedByUser,
} from '@/server/utils/tags';
import { generateRandomPassword } from '@/server/utils/users';

export const userRouter = router({
  getAll: permissionProcedure('users:read').query(async ({ ctx }) => {
    const ownedTagIds = await getTagIdsOwnedByUser(ctx.db, ctx.session.user.id);
    const [users, organizerRoleIds] = await Promise.all([
      ctx.db.query.user.findMany({
        where: visibleUserCondition,
        with: {
          userXTags: buildUserXTagsRelation(ownedTagIds),
          accessRole: { columns: { name: true } },
          user: {
            columns: {
              fullName: true,
            },
          },
        },
      }),
      getRoleIdsWithPermission(ctx.db, 'organizer:act'),
    ]);

    return users.map((user) => ({
      ...user,
      isOrganizer: organizerRoleIds.includes(user.accessRoleId),
    }));
  }),
  getOrganizersByChiefOrganizer: permissionProcedure('organizers:read').query(
    async ({ ctx }) => {
      const ownedTagIds = await getTagIdsOwnedByUser(
        ctx.db,
        ctx.session.user.id,
      );
      const users = await ctx.db.query.user.findMany({
        where: and(
          eq(userTable.chiefOrganizerId, ctx.session.user.id),
          visibleUserCondition,
        ),
        with: {
          userXTags: buildUserXTagsRelation(ownedTagIds),
          accessRole: { columns: { name: true } },
          user: {
            columns: {
              fullName: true,
            },
          },
        },
      });
      return users;
    },
  ),
  getTicketingUsers: anyPermissionProcedure([
    'events:create',
    'events:update',
    'users:read',
  ]).query(async ({ ctx }) => {
    const roleIds = await getRoleIdsWithPermission(ctx.db, 'events:staff');
    if (roleIds.length === 0) return [];

    return ctx.db.query.user.findMany({
      where: and(
        inArray(userTable.accessRoleId, roleIds),
        visibleUserCondition,
      ),
      with: { accessRole: { columns: { name: true } } },
    });
  }),
  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      if (input === ctx.session.user.id) {
        ctx.require('profile:read');
      } else if (
        !ctx.canAny([
          'users:read',
          'organizers:read_all',
          'events:create',
          'events:update',
        ])
      ) {
        ctx.require('organizers:read');
        await assertCanAccessOrganizer(ctx, input);
      }

      const user = await ctx.db.query.user.findFirst({
        where: eq(userTable.id, input),
      });
      if (user && input !== ctx.session.user.id && isHiddenUser(user)) {
        return undefined;
      }
      return user;
    }),
  getUnsensitiveInfoById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.user.findFirst({
        where: eq(userTable.id, input),
        columns: {
          googleDriveUrl: true,
        },
      });

      if (!user) return null;

      return user;
    }),
  create: protectedProcedure
    .input(userSchema)
    .mutation(async ({ ctx, input }) => {
      const assignedRole = await assertCanAssignRole(
        ctx,
        input.accessRoleId,
        'create',
      );

      await assertUniqueUser(ctx.db, input);

      const hashedPassword = await hash(input.password, 10);

      const instagram = input.instagram?.startsWith('@')
        ? input.instagram.slice(1)
        : input.instagram;

      const [user] = await ctx.db
        .insert(userTable)
        .values({
          ...input,
          role: assignedRole.legacyRole,
          accessRoleId: assignedRole.id,
          // Sin ver a todos los organizadores, los que crea quedan en su equipo.
          chiefOrganizerId:
            assignedRole.kind === 'organizer' && !ctx.can('organizers:read_all')
              ? ctx.session.user.id
              : input.chiefOrganizerId,
          fullName: input.fullName,
          name: input.name.trim(),
          password: hashedPassword,
          instagram,
        })
        .returning();
      return user;
    }),
  update: protectedProcedure
    .input(
      userSchema
        .omit({ password: true, chiefOrganizerId: true })
        .extend({ id: z.string() }),
    )
    .mutation(async ({ ctx, input }) => {
      const target = await assertCanManageUser(ctx, input.id, 'update');

      const assignedRole = await assertCanAssignRole(
        ctx,
        input.accessRoleId ?? target.accessRoleId,
        'update',
        target.accessRoleId,
      );

      if (
        target.id === ctx.session.user.id &&
        assignedRole.id !== target.accessRoleId
      ) {
        throw forbidden('No podés cambiar tu propio rol');
      }

      await assertUniqueUser(ctx.db, input, input.id);

      const instagram = input.instagram?.startsWith('@')
        ? input.instagram.slice(1)
        : input.instagram;

      const user = await ctx.db
        .update(userTable)
        .set({
          ...input,
          role: assignedRole.legacyRole,
          accessRoleId: assignedRole.id,
          name: input.name.trim(),
          birthDate: input.birthDate,
          instagram,
        })
        .where(eq(userTable.id, input.id));

      revalidatePath('/admin/users');
      return user;
    }),
  updateOwnProfile: permissionProcedure('profile:update')
    .input(
      userSchema.omit({
        password: true,
        role: true,
        chiefOrganizerId: true,
        accessRoleId: true,
        mercadopago: true,
        googleDriveUrl: true,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertUniqueUser(ctx.db, input, ctx.session.user.id);

      const instagram = input.instagram?.startsWith('@')
        ? input.instagram.slice(1)
        : input.instagram;

      const user = await ctx.db
        .update(userTable)
        .set({
          ...input,
          name: input.name.trim(),
          birthDate: input.birthDate,
          instagram,
        })
        .where(eq(userTable.id, ctx.session.user.id));

      revalidatePath('/profile');
      return user;
    }),
  updateOwnLinks: permissionProcedure('profile:update')
    .input(
      userSchema.pick({
        mercadopago: true,
        googleDriveUrl: true,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(userTable)
        .set({
          mercadopago: input.mercadopago ?? null,
          googleDriveUrl: input.googleDriveUrl ?? null,
        })
        .where(eq(userTable.id, ctx.session.user.id));

      revalidatePath('/profile');
    }),
  partialUpdate: protectedProcedure
    .input(
      userSchema
        .omit({
          password: true,
          chiefOrganizerId: true,
          accessRoleId: true,
          role: true,
          email: true,
          dni: true,
          name: true,
        })
        .partial()
        .extend({ id: z.string() }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanManageUser(ctx, input.id, 'update');

      const instagram = input.instagram?.startsWith('@')
        ? input.instagram.slice(1)
        : input.instagram;

      const user = await ctx.db
        .update(userTable)
        .set({
          ...input,
          instagram,
        })
        .where(eq(userTable.id, input.id));

      return user;
    }),
  resetPassword: protectedProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCanManageUser(ctx, input.id, 'update');

      const hashedPassword = await hash(input.password, 10);

      await ctx.db
        .update(userTable)
        .set({
          password: hashedPassword,
        })
        .where(eq(userTable.id, input.id));

      const user = await ctx.db.query.user.findFirst({
        where: eq(userTable.id, input.id),
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado',
        });
      }

      return {
        username: user.name,
        fullName: user.fullName,
        instagram: user.instagram,
        phoneNumber: user.phoneNumber,
        email: user.email,
      };
    }),
  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      await assertCanManageUser(ctx, input, 'delete');

      const user = await ctx.db
        .delete(userTable)
        .where(eq(userTable.id, input));

      revalidatePath('/admin/users');
      return user;
    }),
  importUsers: permissionProcedure('organizers:import')
    .input(
      z.object({
        users: z.array(
          z.object({
            fullName: z.string().trim().min(1),
            email: z.email(),
            dni: z.string().trim().min(1),
            gender: genderSchema,
            birthDate: z.string(),
            phoneNumber: z.string(),
            instagram: z.string().nullish(),
          }),
        ),
        batchName: z.string().min(1, 'El nombre del grupo es requerido'),
        // Sin mail, la contraseña se pierde: se les da acceso después con
        // "Restablecer contraseña".
        sendWelcomeEmail: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const assignedRole = await assertCanAssignRole(
        ctx,
        SYSTEM_ACCESS_ROLE_IDS.ORGANIZER,
        'create',
      );

      const errors: string[] = [];
      const createdUsers: (typeof userTable.$inferSelect)[] = [];
      const normalizedUsers = input.users.map((user) => ({
        ...user,
        email: user.email.trim().toLowerCase(),
      }));

      // Validar que no existan usuarios duplicados en el archivo
      const emails = new Set<string>();
      const dnis = new Set<string>();

      for (let i = 0; i < normalizedUsers.length; i++) {
        const user = normalizedUsers[i];
        const rowNumber = i + 2;

        if (emails.has(user.email)) {
          errors.push(
            `Fila ${rowNumber}: El email ${user.email} está duplicado en el archivo`,
          );
        } else {
          emails.add(user.email);
        }

        if (dnis.has(user.dni)) {
          errors.push(
            `Fila ${rowNumber}: El DNI ${user.dni} está duplicado en el archivo`,
          );
        } else {
          dnis.add(user.dni);
        }
      }

      if (errors.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Se encontraron errores de validación',
          cause: { errors },
        });
      }

      // Los que ya tienen usuario (mismo DNI o email) se omiten: un export de
      // asistentes casi siempre trae gente que ya está en el sistema.
      const existingUsers =
        normalizedUsers.length === 0
          ? []
          : await ctx.db.query.user.findMany({
              where: or(
                inArray(userTable.dni, [...dnis]),
                inArray(sql`lower(${userTable.email})`, [...emails]),
              ),
              columns: { dni: true, email: true },
            });
      const existingDnis = new Set(existingUsers.map((u) => u.dni));
      const existingEmails = new Set(
        existingUsers.map((u) => u.email.toLowerCase()),
      );

      const skipped: string[] = [];
      const usersToCreate = normalizedUsers.filter((user) => {
        const sameDni = existingDnis.has(user.dni);
        const sameEmail = existingEmails.has(user.email);
        if (!sameDni && !sameEmail) return true;
        skipped.push(
          `${user.fullName} (${sameDni ? `DNI ${user.dni}` : user.email})`,
        );
        return false;
      });

      if (usersToCreate.length === 0) {
        return {
          success: true,
          message:
            'No se creó ningún usuario: todas las personas del archivo ya existen en el sistema',
          createdCount: 0,
          skipped,
        };
      }

      // Crear o obtener el tag del batch (solo del usuario que importa)
      let batchTag: Tag;
      const existingTag = await ctx.db.query.tag.findFirst({
        where: and(
          eq(tagTable.name, input.batchName),
          eq(tagTable.createdById, ctx.session.user.id),
        ),
      });

      if (existingTag) {
        batchTag = existingTag;
      } else {
        const newTag = await ctx.db
          .insert(tagTable)
          .values({
            name: input.batchName,
            createdById: ctx.session.user.id,
          })
          .returning();
        batchTag = newTag[0];
      }

      // Generar usernames únicos
      const baseUsernames = usersToCreate.map(
        (user) => user.email.split('@')[0],
      );

      // Obtener todos los usernames existentes que puedan colisionar con una sola query
      const existingUsernames = await ctx.db.query.user.findMany({
        where: inArray(userTable.name, baseUsernames),
        columns: {
          name: true,
        },
      });

      // Generar usernames únicos evitando colisiones con existentes y entre sí
      const uniqueUsernames = new Map<string, string>();
      const usedUsernames = new Set(existingUsernames.map((u) => u.name));

      for (const user of usersToCreate) {
        const baseUsername = user.email.split('@')[0];
        let finalUsername = baseUsername;
        let counter = 2;

        // Buscar un username único
        while (usedUsernames.has(finalUsername)) {
          finalUsername = `${baseUsername}${counter}`;
          counter++;
        }

        usedUsernames.add(finalUsername);
        uniqueUsernames.set(user.email, finalUsername);
      }

      // Sin ver a todos los organizadores, los importados quedan en su equipo.
      const chiefOrganizerId = ctx.can('organizers:read_all')
        ? null
        : ctx.session.user.id;

      for (const user of usersToCreate) {
        const username = uniqueUsernames.get(user.email)!;
        const randomPassword = generateRandomPassword();
        const hashedPassword = await hash(randomPassword, 10);

        const instagram = user.instagram?.startsWith('@')
          ? user.instagram.slice(1)
          : user.instagram;

        const [newUser] = await ctx.db
          .insert(userTable)
          .values({
            name: username,
            fullName: user.fullName.replace(/\s+/g, ' '),
            password: hashedPassword,
            email: user.email,
            role: assignedRole.legacyRole,
            accessRoleId: assignedRole.id,
            gender: user.gender,
            phoneNumber: user.phoneNumber,
            dni: user.dni,
            birthDate: user.birthDate,
            instagram: instagram || null,
            chiefOrganizerId: chiefOrganizerId,
          })
          .returning();

        if (input.sendWelcomeEmail) {
          await sendMailWithoutAttachments(ctx.instance, {
            to: newUser.email,
            subject: `Bienvenido a la plataforma ${ctx.instance.name}!`,
            html: generateWelcomeEmail(
              ctx.instance,
              newUser.name,
              randomPassword,
            ),
          });
        }

        await ctx.db.insert(userXTag).values({
          a: batchTag.id,
          b: newUser.id,
        });

        createdUsers.push(newUser);
      }

      revalidatePath('/admin/users');

      return {
        success: true,
        message:
          skipped.length > 0
            ? `Se importaron ${createdUsers.length} usuarios. Se omitieron ${skipped.length} que ya existían`
            : `Se importaron ${createdUsers.length} usuarios exitosamente`,
        createdCount: createdUsers.length,
        skipped,
      };
    }),
  getOrganizers: anyPermissionProcedure([
    'organizers:read_all',
    'events:create',
    'events:update',
  ]).query(async ({ ctx }) => {
    const ownedTagIds = await getTagIdsOwnedByUser(ctx.db, ctx.session.user.id);
    const roleIds = await getRoleIdsWithPermission(ctx.db, 'organizer:act');
    if (roleIds.length === 0) return [];

    const organizers = await ctx.db.query.user.findMany({
      where: and(
        inArray(userTable.accessRoleId, roleIds),
        visibleUserCondition,
      ),
      with: {
        userXTags: buildUserXTagsRelation(ownedTagIds),
        accessRole: { columns: { name: true } },
        user: {
          columns: {
            fullName: true,
          },
        },
      },
    });
    return organizers;
  }),
});

async function assertUniqueUser(
  database: Db,
  input: Pick<User, 'email' | 'dni' | 'name'>,
  excludeUserId?: string,
) {
  const existingEmail = await database.query.user.findFirst({
    where: eq(userTable.email, input.email),
  });
  if (existingEmail && existingEmail.id !== excludeUserId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El email ya está en uso',
    });
  }
  const existingDni = await database.query.user.findFirst({
    where: eq(userTable.dni, input.dni),
  });
  if (existingDni && existingDni.id !== excludeUserId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El DNI ya está en uso',
    });
  }
  const existingUsername = await database.query.user.findFirst({
    where: eq(userTable.name, input.name),
  });
  if (existingUsername && existingUsername.id !== excludeUserId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El nombre de usuario ya está en uso',
    });
  }
}
