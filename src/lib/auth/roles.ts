import type { role as roleEnum } from '@/drizzle/schema';

export type TenantRole = (typeof roleEnum.enumValues)[number];
export type AppRole = TenantRole | 'CONTROL_ADMIN';
