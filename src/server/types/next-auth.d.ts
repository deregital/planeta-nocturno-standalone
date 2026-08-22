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
      tenantSlug: string | null;
      fullName: string;
      image: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role: AppRole;
    tenantSlug: string | null;
    fullName: string;
    emailVerified: Date | null;
    image: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantSlug?: string | null;
  }
}
