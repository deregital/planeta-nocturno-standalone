import type { role as roleEnum } from '@/drizzle/schema';

export function getDefaultPathByRole(
  role: (typeof roleEnum.enumValues)[number] | undefined,
): string {
  if (role === 'TICKETING') return '/admin/event';
  if (role === 'CONTROL_TICKETING') return '/admin/ticketing';
  if (role === 'ORGANIZER' || role === 'CHIEF_ORGANIZER')
    return '/organization';
  return '/admin';
}
