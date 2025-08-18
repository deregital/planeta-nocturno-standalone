import { UploadDropzone } from '@/components/ui/upload-dropzone';
import { cn } from '@/lib/utils';
import { useUploadFiles } from 'better-upload/client';

export function ImageUploader({
  onUploadComplete,
  error,
}: {
  onUploadComplete: (objectKey: string) => void;
  error: string | null;
}) {
  const { control } = useUploadFiles({
    route: 'eventImage',
    onUploadComplete: ({ files }) => {
      onUploadComplete(files[0].objectKey);
    },
  });
  return (
    <div>
      <UploadDropzone
        description={{
          maxFiles: 1,
          fileTypes: 'JPG, JPEG, PNG',
        }}
        control={control}
        accept='image/*'
        className={cn(error && 'border-2 border-red-500')}
      />
      {error && <p className='text-red-500 font-bold text-sm'>{error}</p>}
    </div>
  );
}
