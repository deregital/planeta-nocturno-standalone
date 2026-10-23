'use client';

import { signOut } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { resetPostHogUser } from '@/hooks/usePostHogIdentify';

export function SignOutButton() {
  return (
    <Button
      variant='accent'
      onClick={() => {
        resetPostHogUser();
        void signOut();
      }}
    >
      Cerrar sesión
    </Button>
  );
}
