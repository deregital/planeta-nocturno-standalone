import { type DefaultSession } from 'next-auth';

import { type AppRole } from '@/lib/auth/roles';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      emailVerified: Date | null;
      role: AppRole;
      fullName: string;
      image: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role: AppRole;
    fullName: string;
    emailVerified: Date | null;
    image: string | null;
  }
}
