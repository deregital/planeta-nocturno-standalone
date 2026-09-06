/** Convierte un nombre legible a identificador interno (snake_case). */
export function toRoleSlug(displayName: string) {
  return displayName
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/** Muestra un rol snake_case como texto legible. */
export function formatRoleName(slug: string) {
  const withSpaces = slug.replaceAll('_', ' ').trim();
  if (!withSpaces) return slug;
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
