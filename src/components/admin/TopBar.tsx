'use client';
import { signOut } from 'next-auth/react';
import InstanceLogo from '../header/InstanceLogo';
import { Button } from '../ui/button';

export default function TopBar({ userName }: { userName: string }) {
  return (
    <div className='w-full h-16 flex items-center justify-between px-8 bg-pn-black'>
      <InstanceLogo size='sm' />
      <div className='flex flex-row gap-16 items-center text-white'>
        <p>{userName} (admin)</p>
        <Button onClick={() => signOut()}>Cerrar Sesión</Button>
      </div>
    </div>
  );
}
