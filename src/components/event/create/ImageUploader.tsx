import { useUploadFiles } from 'better-upload/client';
import { useState } from 'react';

import { UploadDropzone } from '@/components/ui/upload-dropzone';
import { cn } from '@/lib/utils';

export function ImageUploader({
  onUploadComplete,
  error,
  prepareFile,
  prepareInteractive,
  description: descriptionProp,
}: {
  onUploadComplete: (objectKey: string) => void;
  error: string | null;
  /** Procesa el archivo antes de subirlo (p. ej. compresión tras un recorte). */
  prepareFile?: (file: File) => Promise<File>;
  /**
   * Recibe el archivo elegido y una función `upload`; llamala cuando tengas el
   * archivo final (p. ej. tras un recorte en un modal).
   */
  prepareInteractive?: (file: File, upload: (file: File) => void) => void;
  description?:
    | {
        fileTypes?: string;
        maxFileSize?: string;
        maxFiles?: number;
        extra?: string;
      }
    | string;
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const { control } = useUploadFiles({
    route: 'eventImage',
    onUploadComplete: ({ files }) => {
      onUploadComplete(files[0].objectKey);
    },
  });

  async function handleUploadOverride(
    ...args: Parameters<typeof control.upload>
  ) {
    const [input, options] = args as [
      File[] | FileList,
      Parameters<typeof control.upload>[1],
    ];
    const filesArray = Array.isArray(input) ? input : Array.from(input);
    const file = filesArray?.[0];
    if (!file) return;

    try {
      if (prepareInteractive) {
        prepareInteractive(file, (toUpload) => {
          void (async () => {
            try {
              const finalFile = prepareFile
                ? await prepareFile(toUpload)
                : toUpload;
              setLocalError(null);
              control.upload([finalFile], options);
            } catch {
              setLocalError(
                'No se pudo procesar la imagen. Intentalo nuevamente.',
              );
            }
          })();
        });
        return;
      }

      const toUpload = prepareFile ? await prepareFile(file) : file;
      setLocalError(null);
      control.upload([toUpload], options);
    } catch {
      setLocalError('No se pudo procesar la imagen. Intentalo nuevamente.');
    }
  }

  return (
    <div>
      <UploadDropzone
        description={
          descriptionProp ?? {
            maxFiles: 1,
            fileTypes: 'JPG, JPEG, PNG',
          }
        }
        control={control}
        accept='image/*'
        uploadOverride={handleUploadOverride}
        className={cn((error || localError) && 'border-2 border-red-500')}
      />
      {(error || localError) && (
        <p className='text-red-500 font-bold text-sm'>
          {[error, localError].filter(Boolean).join('. ')}
        </p>
      )}
    </div>
  );
}
