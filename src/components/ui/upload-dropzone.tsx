import type { UploadHookControl } from 'better-upload/client';

import { Loader2, Upload } from 'lucide-react';
import { useId } from 'react';
import { useDropzone } from 'react-dropzone';

import { cn } from '@/lib/utils';

type UploadDropzoneProps = {
  control: UploadHookControl<true>;
  accept?: string;
  metadata?: Record<string, unknown>;
  description?:
    | {
        fileTypes?: string;
        maxFileSize?: string;
        maxFiles?: number;
      }
    | string;
  className?: string;
  uploadOverride?: (
    ...args: Parameters<UploadHookControl<true>['upload']>
  ) => void;

  // Add any additional props you need.
};

export function UploadDropzone({
  control: { upload, isPending },
  accept,
  metadata,
  description,
  uploadOverride,
  className,
}: UploadDropzoneProps) {
  const id = useId();

  const { getRootProps, getInputProps, isDragActive, inputRef } = useDropzone({
    onDrop: (files) => {
      if (files.length > 0 && !isPending) {
        if (uploadOverride) {
          uploadOverride(files, { metadata });
        } else {
          upload(files, { metadata });
        }
      }
      inputRef.current.value = '';
    },
    noClick: true,
  });

  return (
    <div
      className={cn(
        'border-stroke relative rounded-lg border border-dashed transition-colors z-5 bg-cover bg-center',
        {
          'border-accent/80': isDragActive,
        },
        className,
      )}
    >
      <div className='absolute inset-0 bg-accent-ultra-light/70 rounded-lg z-10' />
      <label
        {...getRootProps()}
        className={cn(
          'group flex w-full z-20 sticky cursor-pointer flex-col items-center justify-center rounded-lg bg-transparent px-2 py-6 transition-colors',
          {
            'text-accent cursor-not-allowed opacity-50': isPending,
            'hover:bg-accent-ultra-light/80': !isPending,
          },
        )}
        htmlFor={id}
      >
        <div className='my-2'>
          {isPending ? (
            <Loader2 className='size-6 animate-spin' />
          ) : (
            <Upload className='size-6 text-accent' />
          )}
        </div>

        <div className='mt-3 space-y-1 text-center text-accent'>
          <p className='text-sm font-bold underline group-hover:underline-offset-2 transition-all'>
            Agregar flyer
          </p>

          <p className='text-muted-foreground max-w-64 text-xs'>
            {typeof description === 'string' ? (
              description
            ) : (
              <>
                {description?.maxFiles &&
                  `Podés subir ${description.maxFiles} archivo${description.maxFiles !== 1 ? 's' : ''}.`}{' '}
                {description?.maxFileSize &&
                  `${description.maxFiles !== 1 ? 'Cada archivo' : 'El archivo'} debe pesar menos de ${description.maxFileSize}.`}{' '}
                {description?.fileTypes &&
                  `Se aceptan archivos de tipo ${description.fileTypes}.`}{' '}
                La imagen debe ser cuadrada (relación 1:1).
              </>
            )}
          </p>
        </div>

        <input
          {...getInputProps()}
          type='file'
          multiple
          id={id}
          accept={accept}
          disabled={isPending}
        />
      </label>

      {isDragActive && (
        <div className='bg-background pointer-events-none absolute inset-0 rounded-lg'>
          <div className='dark:bg-accent/30 bg-accent flex size-full flex-col items-center justify-center rounded-lg'>
            <div className='my-2'>
              <Upload className='size-6' />
            </div>

            <p className='mt-3 text-sm font-semibold'>
              Arrastrá y soltá archivos aquí
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
