'use client';

import Image from 'next/image';
import { useState } from 'react';

import { ImageUploader } from '@/components/event/create/ImageUploader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { generateS3Url } from '@/lib/utils-client';

export default function TenantFaviconField({
  initialUrl,
  error,
  slug,
}: {
  initialUrl: string;
  error?: string;
  slug: string;
}) {
  const [faviconUrl, setFaviconUrl] = useState(initialUrl);

  return (
    <div className='space-y-2 md:col-span-2'>
      <Label>Logo</Label>
      <input type='hidden' name='faviconUrl' value={faviconUrl} />

      {faviconUrl ? (
        <div className='flex items-center gap-4 rounded-lg border border-stroke p-4'>
          <div className='relative size-12 overflow-hidden rounded-md border border-stroke bg-white'>
            <Image
              fill
              unoptimized
              src={faviconUrl}
              sizes='48px'
              className='object-contain p-1'
              alt='Logo actual'
            />
          </div>
          <div>
            <p className='text-sm font-medium text-gray-900'>Logo cargado</p>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='mt-1 px-2'
              onClick={() => setFaviconUrl('')}
            >
              Cambiar
            </Button>
          </div>
        </div>
      ) : (
        <>
          {slug ? (
            <ImageUploader
              route='favicon'
              label='Subir logo'
              accept='image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon'
              metadata={{ slug }}
              error={error ?? null}
              description={{
                maxFiles: 1,
                maxFileSize: '1 MB',
                fileTypes: 'PNG, JPG, WEBP o ICO',
                extra: 'Se recomienda una imagen cuadrada.',
              }}
              onUploadComplete={(objectKey) => {
                setFaviconUrl(generateS3Url(objectKey));
              }}
            />
          ) : (
            <p className='rounded-lg border border-dashed border-stroke p-4 text-sm text-gray-500'>
              Definí el subdominio antes de subir el logo.
            </p>
          )}
        </>
      )}

      {faviconUrl && error && (
        <p className='text-xs font-medium text-red-600'>{error}</p>
      )}
    </div>
  );
}
