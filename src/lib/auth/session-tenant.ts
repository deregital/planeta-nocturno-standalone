import type { Session } from 'next-auth';

export function isTenantSessionValid(
  session: Session | null,
  tenantSlug: string | null,
) {
  return (
    session?.user.role !== 'CONTROL_ADMIN' &&
    session?.user.tenantSlug === tenantSlug
  );
}

export function isControlSessionValid(session: Session | null) {
  return (
    session?.user.role === 'CONTROL_ADMIN' && session.user.tenantSlug === null
  );
}
