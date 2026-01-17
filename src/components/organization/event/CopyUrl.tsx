'use client';
import { Link } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

export function CopyUrl({ url }: { url: string }) {
  function copyToClipboard() {
    navigator.clipboard.writeText(url);
    toast.success('URL copiada al portapapeles');
  }
  return (
    <Button variant='accent' className='w-fit' onClick={copyToClipboard}>
      <Link className='w-4 h-4' />
      Copiar mi ticket
    </Button>
  );
}
