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
        // Los errores están directamente en error.data.errors gracias al errorFormatter
        const errorMessages = (error.data?.errors as string[]) || [];

        return {
          success: false,
          message:
            errorMessages.length > 0
              ? error.message || 'Se encontraron errores de validación'
              : error.message || 'Error al importar usuarios',
          errors: errorMessages.length > 0 ? errorMessages : undefined,
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
