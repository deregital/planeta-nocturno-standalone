'use client';
import { Loader2, LogOut } from 'lucide-react';
import { type Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

import { navRoutes } from '@/components/admin/SideBar';
import SideBarTile from '@/components/admin/SideBarTile';
import InstanceLogo from '@/components/header/InstanceLogo';
import GoogleDrive from '@/components/icons/GoogleDrive';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { roleTranslation } from '@/lib/translations';
import { trpc } from '@/server/trpc/client';

export default function TopBar({ auth }: { auth: Session | null }) {
  const pathname = usePathname();
  const { data: user } = trpc.user.getUnsensitiveInfoById.useQuery(
    auth?.user.id as string,
  );
  console.log('user', user);

  return (
    <div className='w-full h-16 flex items-center justify-between px-8 bg-accent-dark'>
      <InstanceLogo size='sm' />
      {auth && (
        <>
          <div className='hidden md:flex flex-row gap-16 items-center text-white'>
            <div className='flex flex-row gap-4 items-center'>
              {user?.googleDriveUrl && (
                <a
                  href={user.googleDriveUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label='Google Drive'
                  className='bg-white hover:bg-gray-200 w-8 h-8 inline-flex items-center justify-center border border-black rounded-sm transition'
                >
                  <GoogleDrive />
                </a>
              )}
              <span className='text-brand'>
                {auth.user.fullName} ({roleTranslation[auth.user.role]})
              </span>
            </div>
            <Button variant={'accent'} onClick={() => signOut()}>
              Cerrar Sesión
            </Button>
          </div>
          <div className='flex md:hidden'>
            {auth ? (
              <Sheet>
                <SheetTrigger className='text-brand'>☰</SheetTrigger>
                <SheetContent
                  side='top'
                  className='w-full bg-accent-dark text-on-accent border-0 gap-0'
                >
                  <div className='flex items-center'>
                    <SheetTitle asChild>
                      <div className='p-4 font-bold text-white'>
                        <InstanceLogo size='sm' />
                      </div>
                    </SheetTitle>
                    {user?.googleDriveUrl && (
                      <a
                        href={user.googleDriveUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        aria-label='Google Drive'
                        className='bg-white hover:bg-gray-200 w-8 h-8 inline-flex items-center justify-center border border-black rounded-sm transition mx-2'
                      >
                        <GoogleDrive />
                      </a>
                    )}
                    <span className='text-brand'>
                      {auth.user.fullName} ({roleTranslation[auth.user.role]})
                    </span>
                  </div>
                  <nav className='flex flex-col py-4 dark'>
                    {navRoutes.map((route, index) => (
                      <SideBarTile
                        show={route.roles.includes(auth.user.role)}
                        key={index}
                        href={route.href}
                        icon={route.icon}
                        title={route.title}
                        isActive={pathname === route.href}
                      />
                    ))}
                    <Button
                      onClick={() => signOut()}
                      variant={'ghost'}
                      className='flex gap-2 justify-baseline items-center py-2 !px-4 m-0 h-fit text-xl font-normal text-brand'
                    >
                      <LogOut />
                      Cerrar Sesión
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            ) : (
              <div className='text-brand'>
                <Loader2 className='animate-spin' />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
