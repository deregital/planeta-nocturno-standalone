import NextAuth, { CredentialsSignin } from 'next-auth';
import { eq } from 'drizzle-orm';
import { compare } from 'bcrypt';

import { db } from '@/drizzle';

import { user as userTable, type role as roleEnum } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';

const credentialsSchema = userSchema.pick({
  name: true,
  password: true,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      type: 'credentials',
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: {
          label: 'Username',
          type: 'text',
          placeholder: 'Nombre de usuario',
        },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const { name, password } = credentialsSchema.parse(credentials);
        const user = await db.query.user.findFirst({
          where: eq(userTable.name, name as string),
        });
        if (!user) throw new CustomError('Usuario no encontrado');
        if (!(await compare(password as string, user.password)))
          throw new CustomError('Contraseña incorrecta');
        return {
          ...user,
          emailVerified: user.emailVerified
            ? new Date(user.emailVerified)
            : null,
        };
      },
    },
  ],
  callbacks: {
    async session({ session, token, user }) {
      if (user) {
        session.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          role: user.role,
          fullName: user.fullName,
          image: user.image,
        };
      } else {
        session.user = {
          id: token.sub as string,
          name: token.name as string,
          email: token.email as string,
          emailVerified: token.emailVerified as Date | null,
          role: token.role as (typeof roleEnum.enumValues)[number],
          fullName: token.fullName as string,
          image: token.image as string | null,
        };
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.fullName = user.fullName;
        token.image = user.image;
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
});

export class CustomError extends CredentialsSignin {
  code = CustomError.CUSTOM_ERROR_CODE;
  static CUSTOM_ERROR_CODE = Symbol('CUSTOM_ERROR_CODE').toString();
  constructor(msg: string) {
    super();
    this.message = msg;
  }
}
