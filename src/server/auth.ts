import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/drizzle';
import { eq } from 'drizzle-orm';
import { user as userSchema } from '@/drizzle/schema';
import { compare } from 'bcrypt';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    {
      type: 'credentials',
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'jsmith@example.com',
        },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing email or password');
        }
        const user = await db.query.user.findFirst({
          where: eq(userSchema.email, credentials.email as string),
        });
        if (!user) throw new Error('User not found');
        if (!(await compare(credentials.password as string, user.password)))
          throw new Error('Invalid password');
        return user;
      },
    },
  ],
  pages: {
    signIn: '/login',
  },
});
