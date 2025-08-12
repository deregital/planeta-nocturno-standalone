import { UploadDropzone } from '@/components/ui/upload-dropzone';
import { useUploadFiles } from 'better-upload/client';

export function ImageUploader() {
  const { control } = useUploadFiles({
    route: 'eventImage',
  });
  return (
    <UploadDropzone
      description={{
        maxFiles: 1,
        fileTypes: 'JPG, JPEG, PNG',
      }}
      control={control}
      accept='image/*'
    />
  );
}
