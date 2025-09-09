'use client';
import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { type Session } from 'next-auth';
import { useEffect, useState } from 'react';

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import InstanceLogo from '@/components/header/InstanceLogo';
import { navRoutes } from '@/components/admin/SideBar';
import SideBarTile from '@/components/admin/SideBarTile';
import { roleTranslation } from '@/lib/translations';

export default function TopBar({ auth }: { auth: Session | null }) {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className='w-full h-16 flex items-center justify-between px-8 bg-accent-dark'>
      <InstanceLogo size='sm' />
      {auth && (
        <>
          <div className='hidden md:flex flex-row gap-16 items-center text-white'>
            <span className='text-brand'>
              {auth.user.fullName} ({roleTranslation[auth.user.role]})
            </span>
            <Button variant={'accent'} onClick={() => signOut()}>
              Cerrar Sesión
            </Button>
          </div>
          <div className='flex md:hidden'>
            {isMounted ? (
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
              <div className='text-brand'>☰</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
