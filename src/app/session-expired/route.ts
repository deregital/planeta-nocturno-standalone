import { signOut } from '@/server/auth';

/**
 * Cierra la sesión de un usuario eliminado con la sesión abierta, que antes
 * quedaba en 'Sin acceso: tu rol no tiene permisos'. Las páginas no pueden
 * borrar cookies durante el render.
 */
export async function GET() {
  await signOut({ redirectTo: '/login' });
}
