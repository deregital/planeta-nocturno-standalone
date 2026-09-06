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
  route = 'eventImage',
  label,
  accept = 'image/*',
  metadata,
  className,
  uploadErrorMessage = 'No se pudo subir la imagen. Intentalo nuevamente.',
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
  route?: string;
  label?: string;
  accept?: string;
  metadata?: Record<string, unknown>;
  className?: string;
  /** Mensaje cuando falla la subida a S3 o el procesamiento. */
  uploadErrorMessage?: string;
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
    route,
    onUploadComplete: ({ files }) => {
      try {
        onUploadComplete(files[0].objectKey);
        setLocalError(null);
      } catch {
        setLocalError(uploadErrorMessage);
      }
    },
    onUploadFail: () => {
      setLocalError(uploadErrorMessage);
    },
    onError: () => {
      setLocalError(uploadErrorMessage);
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
              setLocalError(uploadErrorMessage);
            }
          })();
        });
        return;
      }

      const toUpload = prepareFile ? await prepareFile(file) : file;
      setLocalError(null);
      control.upload([toUpload], options);
    } catch {
      setLocalError(uploadErrorMessage);
    }
  }

  return (
    <div className={cn(className)}>
      <UploadDropzone
        description={
          descriptionProp ?? {
            maxFiles: 1,
            fileTypes: 'JPG, JPEG, PNG',
          }
        }
        control={control}
        accept={accept}
        metadata={metadata}
        uploadOverride={handleUploadOverride}
        label={label}
        className={cn((error || localError) && 'border-2 border-red-500')}
      />
      {(error || localError) && (
        <p className='text-red-500 font-bold text-xs pl-1'>
          {[error, localError].filter(Boolean).join('. ')}
        </p>
      )}
    </div>
  );
}
