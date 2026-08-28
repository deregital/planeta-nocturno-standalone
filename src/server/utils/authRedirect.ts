import type { AppRole } from '@/lib/auth/roles';

export function getDefaultPathByRole(role: AppRole | undefined): string {
  if (role === 'CONTROL_ADMIN') return '/';
  if (role === 'TICKETING') return '/admin/event';
  if (role === 'CONTROL_TICKETING') return '/admin/ticketing';
  if (role === 'ORGANIZER' || role === 'CHIEF_ORGANIZER')
    return '/organization';
  return '/admin';
}
