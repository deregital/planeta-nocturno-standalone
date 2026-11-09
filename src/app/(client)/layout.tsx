import TopBar from '@/components/admin/TopBar';
import { auth } from '@/server/auth';

export default async function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    // minmax(0,1fr): un elemento rígido de la página no puede ensanchar la
    // grilla (y con ella el header) más allá de la pantalla.
    <div className='grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] h-screen'>
      <TopBar auth={session} />
      {children}
    </div>
  );
}
