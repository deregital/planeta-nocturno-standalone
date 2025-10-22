import { TRPCError } from '@trpc/server';
import { compare, hash } from 'bcrypt';
import { eq, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { type db } from '@/drizzle';

import {
  tempPassword as tempPasswordTable,
  user as userTable,
} from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';
import { adminProcedure, publicProcedure, router } from '@/server/trpc';
import { getBuyersCodeByDni } from '@/server/utils/utils';

export const userRouter = router({
  getAll: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.query.user.findMany();

    const usersWithAutoId = await getBuyersCodeByDni(
      ctx.db,
      users.map((user) => user.id),
    );

    return users.map((user) => ({
      ...user,
      id:
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

    const user = await ctx.db.insert(userTable).values({
      ...input,
      fullName: input.fullName,
      name: input.username,
      password: hashedPassword,
    });
    return user;
  }),
  update: adminProcedure
    .input(userSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertUniqueUser(ctx.db, input, input.id);

      const hashedPassword = await hash(input.password, 10);
      const user = await ctx.db
        .update(userTable)
        .set({
          ...input,
          name: input.username,
          birthDate: input.birthDate,
          password: hashedPassword,
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
      z.array(
        z.object({
          nombre: z.string(),
          apellido: z.string(),
          email: z.email(),
          dni: z.string(),
          fechaNacimiento: z.string(),
          telefono: z.string(),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const errors: string[] = [];
      const createdUsers: any[] = [];

      // Validar que no existan usuarios duplicados en el archivo
      const emails = new Set<string>();
      const dnis = new Set<string>();

      for (let i = 0; i < input.length; i++) {
        const user = input[i];
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
      for (let i = 0; i < input.length; i++) {
        const user = input[i];
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
          message:
            'Se encontraron usuarios que ya existen en el sistema: \n' +
            errors.join('\n\t\t'),
          cause: { errors },
        });
      }

      // Función para generar contraseña aleatoria
      const generateRandomPassword = (): string => {
        const chars =
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
      };

      // Crear usuarios
      for (const user of input) {
        const fullName = `${user.nombre} ${user.apellido}`.trim();
        const username = user.email.split('@')[0]; // Usar parte del email como username
        const randomPassword = generateRandomPassword();
        const hashedPassword = await hash(randomPassword, 10);

        const newUser = await ctx.db
          .insert(userTable)
          .values({
            name: username,
            fullName: fullName,
            password: hashedPassword,
            email: user.email,
            role: 'ORGANIZER', // Rol por defecto para usuarios importados
            gender: 'other', // Valor por defecto
            phoneNumber: user.telefono,
            dni: user.dni,
            birthDate: user.fechaNacimiento,
          })
          .returning();

        // Guardar contraseña temporal para envío por email
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // Expira en 30 días

        await ctx.db.insert(tempPasswordTable).values({
          userId: newUser[0].id,
          password: randomPassword,
          expiresAt: expiresAt.toISOString(),
        });

        createdUsers.push(newUser[0]);
      }

      revalidatePath('/admin/users');

      return {
        success: true,
        message: `Se importaron ${createdUsers.length} usuarios exitosamente`,
        createdCount: createdUsers.length,
      };
    }),
  getTempPasswords: adminProcedure.query(async ({ ctx }) => {
    const tempPasswords = await ctx.db.query.tempPassword.findMany({
      where: eq(tempPasswordTable.sent, false),
      with: {
        user: {
          columns: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return tempPasswords.map((temp) => ({
      id: temp.id,
      userId: temp.userId,
      password: temp.password,
      userEmail: temp.user.email,
      userName: temp.user.fullName,
      expiresAt: temp.expiresAt,
    }));
  }),
  markPasswordAsSent: adminProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tempPasswordTable)
        .set({ sent: true })
        .where(eq(tempPasswordTable.id, input));

      return { success: true };
    }),
});

async function assertUniqueUser(
  database: typeof db,
  input: z.infer<typeof userSchema>,
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
    where: eq(userTable.name, input.username),
  });
  if (existingUsername && existingUsername.id !== excludeUserId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El nombre de usuario ya está en uso',
    });
  }
}
