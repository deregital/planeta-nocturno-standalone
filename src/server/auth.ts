import { compare } from 'bcrypt';
import { eq } from 'drizzle-orm';
import NextAuth, { CredentialsSignin, type Session } from 'next-auth';

import { getControlDb } from '@/db/control/client';
import { controlAdmins } from '@/db/control/schema';
import { user as userTable } from '@/drizzle/schema';
import { isControlRequest } from '@/server/control/is-control-request';
import { resolveRequestContext } from '@/server/instance/resolve-request-context';
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
      authorize: async (credentials, request) => {
        const { name, password } = credentialsSchema.parse(credentials);

        if (isControlRequest(request.headers)) {
          const admin = await getControlDb().query.controlAdmins.findFirst({
            where: eq(controlAdmins.username, name),
          });
          if (!admin) throw new CustomError('Usuario no encontrado');
          if (!(await compare(password, admin.password))) {
            throw new CustomError('Contraseña incorrecta');
          }

          return {
            id: admin.id,
            name: admin.username,
            email: admin.email,
            emailVerified: null,
            role: 'CONTROL_ADMIN',
            fullName: admin.username,
            image: null,
          };
        }

        const { db } = await resolveRequestContext(request.headers);
        const user = await db.query.user.findFirst({
          where: eq(userTable.name, name),
        });
        if (!user) throw new CustomError('Usuario no encontrado');
        if (!(await compare(password, user.password)))
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
          role: token.role as Session['user']['role'],
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
