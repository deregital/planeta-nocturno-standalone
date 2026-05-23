'use client';

import { Link } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

export function CopyUrl({ url }: { url: string; eventName?: string }) {
  function copyToClipboard() {
    void navigator.clipboard.writeText(url);
    toast.success('URL copiada al portapapeles');
  }

  return (
    <Button
      type='button'
      variant='accent'
      className='w-fit'
      onClick={copyToClipboard}
    >
      <Link className='h-4 w-4' />
      Copiar mi ticket
    </Button>
  );
}
