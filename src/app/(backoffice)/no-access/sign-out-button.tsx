'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { resetPostHogUser } from '@/hooks/usePostHogIdentify';

export function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Button
      variant='accent'
      loading={signingOut}
      onClick={() => {
        setSigningOut(true);
        resetPostHogUser();
        void signOut().catch(() => setSigningOut(false));
      }}
    >
      Cerrar sesión
    </Button>
  );
}
