'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { type UserFirstTimeCredentials } from '@/app/(backoffice)/admin/users/create/actions';
import { Instagram } from '@/components/icons/Instagram';
import { WhatsApp } from '@/components/icons/WhatsApp';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type CredentialsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentials: UserFirstTimeCredentials;
  type: 'user' | 'organizer';
};

export function CredentialsModal({
  open,
  onOpenChange,
  credentials,
  type,
}: CredentialsModalProps) {
  const [copied, setCopied] = useState(false);

  const credentialsText = `Usuario: ${credentials.username}\nContraseña: ${credentials.password}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(credentialsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareMessage = encodeURIComponent(
    `Credenciales de acceso:\nUsuario: ${credentials.username}\nContraseña: ${credentials.password}`,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {type === 'organizer' ? 'Organizador creado' : 'Usuario creado'}
          </DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          <p className='text-sm text-gray-600'>
            Las credenciales han sido creadas exitosamente. Podés compartirlas
            con el {type === 'organizer' ? 'organizador' : 'usuario'}.
          </p>

          <div
            onClick={handleCopy}
            className='cursor-pointer rounded-lg border border-gray-300 bg-gray-50 p-4 font-mono text-sm transition-colors hover:bg-gray-100 hover:border-gray-400 flex items-start justify-between gap-3'
          >
            <div className='flex-1 space-y-1 whitespace-pre-line'>
              <div>
                <span className='text-gray-600'>Usuario: </span>
                <span className='text-gray-900'>{credentials.username}</span>
              </div>
              <div>
                <span className='text-gray-600'>Contraseña: </span>
                <span className='text-gray-900'>{credentials.password}</span>
              </div>
            </div>
            {copied ? (
              <Check className='h-5 w-5 text-green-600 shrink-0' />
            ) : (
              <Copy className='h-5 w-5 text-gray-500 shrink-0' />
            )}
          </div>

          <div className='flex flex-col gap-2'>
            <p className='text-sm font-medium'>Compartir credenciales:</p>
            <div className='flex gap-4 justify-center'>
              <a
                href={`https://wa.me/${credentials.phoneNumber}?text=${shareMessage}`}
                target='_blank'
              >
                <div className='flex items-center justify-center p-4 rounded-full bg-[#00C500] hover:brightness-110 transition-all cursor-pointer'>
                  <WhatsApp />
                </div>
              </a>
              <a
                href={`https://ig.me/m/${credentials.instagram}?text=${shareMessage}`}
                target='_blank'
              >
                <div
                  className='flex items-center justify-center p-4 rounded-full transition-all cursor-pointer text-white hover:brightness-110'
                  style={{
                    background:
                      'radial-gradient(circle at 30% 110%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)',
                  }}
                >
                  <Instagram />
                </div>
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
