import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { compare } from 'bcrypt';

import { db } from '@/drizzle';

import { user as userTable } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';

const credentialsSchema = userSchema.pick({
  name: true,
  password: true,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
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
        if (!user) throw new Error('User not found');
        if (!(await compare(password as string, user.password)))
          throw new Error('Invalid password');
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
          role: token.role as string,
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
