import { TRPCError } from '@trpc/server';
import { hash } from 'bcrypt';
import { and, eq, inArray, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { Db } from '@/drizzle';

import { tag as tagTable, user as userTable, userXTag } from '@/drizzle/schema';
import { resetPasswordSchema, userSchema } from '@/server/schemas/user';
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
            nombre: z.string(),
            apellido: z.string(),
            email: z.email(),
            dni: z.string(),
            fechaNacimiento: z.string(),
            telefono: z.string(),
            instagram: z.string().nullish(),
          }),
        ),
        batchName: z.string().min(1, 'El nombre del grupo es requerido'),
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

      // Validar que no existan usuarios duplicados en el archivo
      const emails = new Set<string>();
      const dnis = new Set<string>();

      for (let i = 0; i < input.users.length; i++) {
        const user = input.users[i];
        const rowNumber = i + 1;

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

      // Validar que los usuarios no existan en la base de datos
      for (let i = 0; i < input.users.length; i++) {
        const user = input.users[i];
        const rowNumber = i + 1;

        const existingEmail = await ctx.db.query.user.findFirst({
          where: eq(userTable.email, user.email),
        });
        if (existingEmail) {
          errors.push(
            `Fila ${rowNumber}: El email ${user.email} ya existe en el sistema`,
          );
        }

        const existingUser = await ctx.db.query.user.findFirst({
          where: or(
            eq(userTable.dni, user.dni),
            eq(userTable.email, user.email),
          ),
        });
        if (existingUser) {
          if (existingUser.dni === user.dni) {
            errors.push(
              `Fila ${rowNumber}: El DNI ${user.dni} ya existe en el sistema`,
            );
          }
          if (existingUser.email === user.email) {
            errors.push(
              `Fila ${rowNumber}: El email ${user.email} ya existe en el sistema`,
            );
          }
        }
      }

      if (errors.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Se encontraron usuarios que ya existen en el sistema',
          cause: { errors },
        });
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
      const baseUsernames = input.users.map((user) => user.email.split('@')[0]);

      // Obtener todos los usernames existentes que puedan colisionar con una sola query
      const existingUsernames = await ctx.db.query.user.findMany({
        where: inArray(userTable.name, baseUsernames),
        columns: {
          name: true,
        },
      });

      const existingUsernamesSet = new Set(
        existingUsernames.map((u) => u.name),
      );

      // Generar usernames únicos evitando colisiones con existentes y entre sí
      const uniqueUsernames = new Map<string, string>();
      const usedUsernames = new Set(existingUsernamesSet);

      for (let i = 0; i < input.users.length; i++) {
        const user = input.users[i];
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

      for (const user of input.users) {
        const fullName = `${user.nombre} ${user.apellido}`.trim();
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
            fullName: fullName,
            password: hashedPassword,
            email: user.email,
            role: assignedRole.legacyRole,
            accessRoleId: assignedRole.id,
            gender: 'other',
            phoneNumber: user.telefono,
            dni: user.dni,
            birthDate: user.fechaNacimiento,
            instagram: instagram || null,
            chiefOrganizerId: chiefOrganizerId,
          })
          .returning();

        await sendMailWithoutAttachments(ctx.instance, {
          to: newUser.email,
          subject: `Bienvenido a la plataforma ${ctx.instance.name}!`,
          html: generateWelcomeEmail(
            ctx.instance,
            newUser.name,
            randomPassword,
          ),
        });

        await ctx.db.insert(userXTag).values({
          a: batchTag.id,
          b: newUser.id,
        });

        createdUsers.push(newUser);
      }

      revalidatePath('/admin/users');

      return {
        success: true,
        message: `Se importaron ${createdUsers.length} usuarios exitosamente`,
        createdCount: createdUsers.length,
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
