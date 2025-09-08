import { type DefaultSession } from 'next-auth';

import { type role as roleEnum } from '@/drizzle/schema';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      emailVerified: Date | null;
      role: (typeof roleEnum.enumValues)[number];
      fullName: string;
      image: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role: (typeof roleEnum.enumValues)[number];
    fullName: string;
    emailVerified: Date | null;
    image: string | null;
  }
}
