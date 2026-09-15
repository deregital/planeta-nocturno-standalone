'use client';

import { Building2, LogOut, Menu, Shield, Users } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type ControlHeaderProps = {
  homeHref: Route;
  userName: string;
  canReadTenants: boolean;
  canReadAdmins: boolean;
  canReadRoles: boolean;
  signOutAction: () => Promise<void>;
};

type NavItem = {
  href: Route;
  label: string;
  icon: React.ReactNode;
  show: boolean;
};

export default function ControlHeader({
  homeHref,
  userName,
  canReadTenants,
  canReadAdmins,
  canReadRoles,
  signOutAction,
}: ControlHeaderProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      href: '/' as Route,
      label: 'Plataformas',
      icon: <Building2 className='size-4' />,
      show: canReadTenants,
    },
    {
      href: '/users' as Route,
      label: 'Usuarios',
      icon: <Users className='size-4' />,
      show: canReadAdmins,
    },
    {
      href: '/roles' as Route,
      label: 'Roles',
      icon: <Shield className='size-4' />,
      show: canReadRoles,
    },
  ];

  const visibleItems = navItems.filter((item) => item.show);

  return (
    <header className='flex h-16 items-center justify-between gap-4 bg-accent-dark px-4 text-white sm:px-6'>
      <div className='flex items-center gap-6'>
        <Link href={homeHref} className='hover:opacity-90'>
          <p className='font-bold'>Panel central</p>
          <p className='text-xs text-brand'>Administración general</p>
        </Link>
        <nav className='hidden items-center gap-1 sm:flex'>
          {visibleItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              isActive={pathname === item.href}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className='flex items-center gap-4'>
        <span className='hidden text-sm text-brand sm:block'>{userName}</span>
        <form action={signOutAction} className='hidden sm:block'>
          <Button type='submit' variant='accent' size='sm'>
            <LogOut />
            Cerrar sesión
          </Button>
        </form>

        <Sheet>
          <SheetTrigger
            className='inline-flex items-center justify-center rounded-md p-2 text-brand hover:bg-white/10 hover:text-white sm:hidden'
            aria-label='Abrir menú'
          >
            <Menu className='size-5' />
          </SheetTrigger>
          <SheetContent
            side='top'
            className='w-full gap-0 border-0 bg-accent-dark text-on-accent'
          >
            <SheetTitle asChild>
              <div className='flex flex-col gap-1 p-4 pr-12'>
                <p className='font-bold text-white'>Panel central</p>
                <p className='text-sm text-brand'>{userName}</p>
              </div>
            </SheetTitle>
            <nav className='flex flex-col py-2'>
              {visibleItems.map((item) => (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-3 text-base text-brand hover:bg-white/10 hover:text-white',
                      pathname === item.href &&
                        'bg-white/10 font-semibold text-white',
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
              <form action={signOutAction} className='border-t border-white/10'>
                <Button
                  type='submit'
                  variant='ghost'
                  className='h-auto w-full justify-start gap-2 rounded-none px-4 py-3 text-base font-normal text-brand hover:bg-white/10 hover:text-white'
                >
                  <LogOut className='size-4' />
                  Cerrar sesión
                </Button>
              </form>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function NavLink({
  href,
  icon,
  isActive,
  children,
}: {
  href: Route;
  icon: React.ReactNode;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-brand hover:bg-white/10 hover:text-white',
        isActive && 'bg-white/10 text-white',
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
