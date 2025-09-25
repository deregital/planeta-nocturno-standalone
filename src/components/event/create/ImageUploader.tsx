import { useUploadFiles } from 'better-upload/client';
import { useState } from 'react';

import { UploadDropzone } from '@/components/ui/upload-dropzone';
import { cn } from '@/lib/utils';

export function ImageUploader({
  onUploadComplete,
  error,
}: {
  onUploadComplete: (objectKey: string) => void;
  error: string | null;
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const { control } = useUploadFiles({
    route: 'eventImage',
    onUploadComplete: ({ files }) => {
      onUploadComplete(files[0].objectKey);
    },
  });

  // Override del upload para validar relacion de aspecto de la imagen
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
      const bitmap = await createImageBitmap(file);
      if (bitmap.width !== bitmap.height) {
        setLocalError('La imagen debe ser cuadrada (relación 1:1).');
      } else {
        setLocalError(null);
        control.upload(input, options);
      }
    } catch {
      setLocalError('No se pudo leer la imagen. Intentalo nuevamente.');
    }
  }

  return (
    <div>
      <UploadDropzone
        description={{
          maxFiles: 1,
          fileTypes: 'JPG, JPEG, PNG',
        }}
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
