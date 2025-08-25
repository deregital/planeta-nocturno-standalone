import { z } from 'zod';

import { role } from '@/drizzle/schema';

export const userSchema = z.object({
  name: z.string().min(1),
  password: z.string().min(1),
  email: z.email(),
  fullName: z.string().min(1),
  role: z.enum(role.enumValues),
});
