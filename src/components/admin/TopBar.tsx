'use client';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import InstanceLogo from '../header/InstanceLogo';
import { Button } from '../ui/button';
import { navRoutes } from './SideBar';
import SideBarTile from './SideBarTile';

export default function TopBar({ userName }: { userName: string }) {
  return (
    <div className='w-full h-16 flex items-center justify-between px-8 bg-pn-black'>
      <InstanceLogo size='sm' />
      <div className='hidden md:flex flex-row gap-16 items-center text-white'>
        <p>{userName} (admin)</p>
        <Button onClick={() => signOut()}>Cerrar Sesión</Button>
      </div>
      <div className='flex md:hidden'>
        <Sheet>
          <SheetTrigger asChild>
            <button className='text-white'>☰</button>
          </SheetTrigger>
          <SheetContent
            side='top'
            className='w-full bg-pn-black text-white border-0'
          >
            <div className='flex items-center'>
              <SheetTitle className='p-4 font-bold text-white'>
                <InstanceLogo size='sm' />
              </SheetTitle>
              <p>{userName} (admin)</p>
            </div>
            <nav className='flex flex-col p-4 gap-4'>
              {navRoutes.map((route, index) => (
                <SideBarTile
                  key={index}
                  href={route.href}
                  icon={route.icon}
                  title={route.title}
                />
              ))}
              <Button
                onClick={() => signOut()}
                variant={'ghost'}
                className='flex gap-2 justify-baseline items-center p-0 m-0 !px-0.5 h-fit text-xl font-normal'
              >
                <LogOut />
                Cerrar Sesión
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
