import TopBar from '@/components/admin/TopBar';
import { LegalFooter } from '@/components/legal/LegalFooter';
import { getLandingPath, NO_ACCESS_PATH } from '@/lib/rbac/navigation';
import { auth } from '@/server/auth';
import { getCurrentAccess } from '@/server/rbac/guards';

export default async function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  // El panel que le toca según sus permisos (/admin/... u /organization).
  const access = session ? await getCurrentAccess() : null;
  const landingPath = access ? getLandingPath(access.permissions) : null;
  const panelHref = landingPath === NO_ACCESS_PATH ? null : landingPath;

  return (
    // minmax(0,1fr): un elemento rígido de la página no puede ensanchar la
    // grilla (y con ella el header) más allá de la pantalla.
    <div className='grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] h-screen'>
      <TopBar auth={session} panelHref={panelHref} />
      {children}
      <LegalFooter />
    </div>
  );
}
