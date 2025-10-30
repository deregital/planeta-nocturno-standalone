'use client';

import { trpc } from '@/server/trpc/client';
import { type ImportUserData } from '@/lib/userImportUtils';
import { ImportUsersModal } from '@/components/admin/users/ImportUsersModal';

interface ImportResult {
  success: boolean;
  message: string;
  errors?: string[];
  createdCount?: number;
}

export function ImportUsersWrapper() {
  const importUsersMutation = trpc.user.importUsers.useMutation();

  const handleImport = async (
    users: ImportUserData[],
    batchName: string,
  ): Promise<ImportResult> => {
    try {
      const result = await importUsersMutation.mutateAsync({
        users,
        batchName,
      });
      return result;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Manejar errores de TRPC
      if (error?.data?.code === 'BAD_REQUEST') {
        const errorMessages = error.cause?.errors || [];
        return {
          success: false,
          message:
            errorMessages.length > 0
              ? 'Se encontraron errores de validación'
              : error.message,
          errors: errorMessages.length > 0 ? errorMessages : [error.message],
        };
      }

      return {
        success: false,
        message: error?.message || 'Error desconocido al importar usuarios',
      };
    }
  };

  return <ImportUsersModal onImport={handleImport} />;
}
