import { signOut } from '@/server/auth';

/**
 * Cierra la sesión de un admin que ya no existe o se quedó sin permisos. Las
 * páginas no pueden borrar cookies durante el render: el signOut ahí tiraba
 * 'Algo salió mal' en todo el panel, incluido /login.
 */
export async function GET() {
  await signOut({ redirectTo: '/login' });
}
