import { TRPCError } from '@trpc/server';
import { compare, hash } from 'bcrypt';
import { eq, inArray, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { type db } from '@/drizzle';

import { tag as tagTable, user as userTable, userXTag } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';
import {
  generateWelcomeEmail,
  sendMailWithoutAttachments,
} from '@/server/services/mail';
import { adminProcedure, publicProcedure, router } from '@/server/trpc';
import { type Tag, type User } from '@/server/types';
import { generateRandomPassword } from '@/server/utils/users';
import { getBuyersCodeByDni } from '@/server/utils/utils';

export const userRouter = router({
  getAll: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.query.user.findMany({
      with: {
        userXTags: {
          with: {
            tag: true,
          },
        },
      },
    });

    const usersWithAutoId = await getBuyersCodeByDni(
      ctx.db,
      users.map((user) => user.id),
    );

    return users.map((user) => ({
      ...user,
      autoId:
        usersWithAutoId?.find((code) => code.dni === user.id)?.id.toString() ||
        '---',
    }));
  }),
  getTicketingUsers: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.query.user.findMany({
      where: eq(userTable.role, 'TICKETING'),
    });
    return users;
  }),
  getById: adminProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const user = await ctx.db.query.user.findFirst({
      where: eq(userTable.id, input),
    });
    return user;
  }),
  getByName: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const user = await ctx.db.query.user.findFirst({
      where: eq(userTable.name, input),
    });
    return user;
  }),
  isPasswordValid: publicProcedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.user.findFirst({
        where: eq(userTable.name, input.username),
        columns: {
          password: true,
        },
      });

      if (!user) return null;

      return await compare(input.password, user.password);
    }),
  create: adminProcedure.input(userSchema).mutation(async ({ ctx, input }) => {
    await assertUniqueUser(ctx.db, input);

    const hashedPassword = await hash(input.password, 10);
    const [user] = await ctx.db
      .insert(userTable)
      .values({
        ...input,
        fullName: input.fullName,
        name: input.name,
        password: hashedPassword,
      })
      .returning();
    await sendMailWithoutAttachments({
      to: user.email,
      subject: `Bienvenido a la plataforma ${process.env.NEXT_PUBLIC_INSTANCE_NAME}!`,
      html: generateWelcomeEmail(user.name, input.password),
    });
    return user;
  }),
  update: adminProcedure
    .input(userSchema.omit({ password: true }).extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertUniqueUser(ctx.db, input, input.id);

      const user = await ctx.db
        .update(userTable)
        .set({
          ...input,
          name: input.name,
          birthDate: input.birthDate,
        })
        .where(eq(userTable.id, input.id));

      revalidatePath('/admin/users');
      return user;
    }),
  delete: adminProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const user = await ctx.db.delete(userTable).where(eq(userTable.id, input));

    revalidatePath('/admin/users');
    return user;
  }),
  importUsers: adminProcedure
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
          }),
        ),
        batchName: z.string().min(1, 'El nombre del grupo es requerido'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

      // Crear o obtener el tag del batch
      let batchTag: Tag;
      const existingTag = await ctx.db.query.tag.findFirst({
        where: eq(tagTable.name, input.batchName),
      });

      if (existingTag) {
        batchTag = existingTag;
      } else {
        const newTag = await ctx.db
          .insert(tagTable)
          .values({ name: input.batchName })
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

      for (const user of input.users) {
        const fullName = `${user.nombre} ${user.apellido}`.trim();
        const username = uniqueUsernames.get(user.email)!;
        const randomPassword = generateRandomPassword();
        const hashedPassword = await hash(randomPassword, 10);

        const [newUser] = await ctx.db
          .insert(userTable)
          .values({
            name: username,
            fullName: fullName,
            password: hashedPassword,
            email: user.email,
            role: 'ORGANIZER',
            gender: 'other',
            phoneNumber: user.telefono,
            dni: user.dni,
            birthDate: user.fechaNacimiento,
          })
          .returning();

        await sendMailWithoutAttachments({
          to: newUser.email,
          subject: `Bienvenido a la plataforma ${process.env.NEXT_PUBLIC_INSTANCE_NAME}!`,
          html: generateWelcomeEmail(newUser.name, randomPassword),
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
  getOrganizers: adminProcedure.query(async ({ ctx }) => {
    const organizers = await ctx.db.query.user.findMany({
      where: eq(userTable.role, 'ORGANIZER'),
      with: {
        userXTags: {
          with: {
            tag: true,
          },
        },
      },
    });
    return organizers;
  }),
});

async function assertUniqueUser(
  database: typeof db,
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
