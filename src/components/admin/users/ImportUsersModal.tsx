'use client';

import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  generateTemplate,
  processExcelFile,
  type ImportUserData,
} from '@/lib/userImportUtils';
import { trpc } from '@/server/trpc/client';
import { useRouter } from 'next/navigation';

interface ImportUsersModalProps {
  onImport: (users: ImportUserData[]) => Promise<ImportResult>;
}

interface ImportResult {
  success: boolean;
  message: string;
  errors?: string[];
  createdCount?: number;
}

export function ImportUsersModal({ onImport }: ImportUsersModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (
        selectedFile.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        selectedFile.type === 'application/vnd.ms-excel'
      ) {
        setFile(selectedFile);
        setResult(null);
      } else {
        alert('Por favor selecciona un archivo Excel (.xlsx)');
      }
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setResult(null);

    try {
      const parseResult = await processExcelFile(file);

      if (parseResult.errors.length > 0) {
        setResult({
          success: false,
          message: 'Se encontraron errores de validación',
          errors: parseResult.errors.map(
            (error) => `Fila ${error.rowNumber}: ${error.message}`,
          ),
        });
        setIsLoading(false);
        return;
      }

      if (parseResult.users.length === 0) {
        setResult({
          success: false,
          message: 'No se encontraron usuarios válidos en el archivo',
        });
        setIsLoading(false);
        return;
      }

      // Procesar importación
      const importResult = await onImport(parseResult.users);
      setResult(importResult);

      if (importResult.success) {
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        router.refresh();
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    generateTemplate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' className='w-fit'>
          <Upload className='w-4 h-4 mr-2' />
          Importar usuarios
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Importar usuarios desde Excel</DialogTitle>
        </DialogHeader>

        <div className='space-y-6'>
          {/* Template download */}
          <div className='space-y-2'>
            <Label>Plantilla de ejemplo</Label>
            <Button
              variant='outline'
              onClick={downloadTemplate}
              className='w-full'
            >
              <FileSpreadsheet className='w-4 h-4 mr-2' />
              Descargar plantilla (.xlsx)
            </Button>
            <p className='text-sm text-muted-foreground'>
              Descarga la plantilla para ver el formato correcto de las columnas
            </p>
          </div>

          {/* File upload */}
          <div className='space-y-2'>
            <Label htmlFor='file-upload'>Seleccionar archivo Excel</Label>
            <Input
              id='file-upload'
              type='file'
              accept='.xlsx,.xls'
              onChange={handleFileSelect}
              ref={fileInputRef}
            />
            {file && (
              <p className='text-sm text-green-600'>
                Archivo seleccionado: {file.name}
              </p>
            )}
          </div>

          {/* Required columns info */}
          <Alert>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              <strong>Columnas requeridas:</strong>
              <br />
              • Nombre
              <br />
              • Apellido
              <br />
              • Dirección de correo electrónico
              <br />
              • DNI
              <br />
              • Fecha nacimiento en formato YYYY-MM-DD
              <br />• Número de teléfono (se formatea automáticamente con +549)
            </AlertDescription>
          </Alert>

          {/* Result display */}
          {result && (
            <Alert
              className={
                result.success
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }
            >
              {result.success ? (
                <CheckCircle2 className='h-4 w-4 text-green-600' />
              ) : (
                <AlertCircle className='h-4 w-4 text-red-600' />
              )}
              <AlertDescription>
                <div className='space-y-2'>
                  <p
                    className={
                      result.success ? 'text-green-800' : 'text-red-800'
                    }
                  >
                    {result.message}
                  </p>
                  {result.createdCount && (
                    <p className='text-green-800'>
                      Se crearon {result.createdCount} usuarios exitosamente.
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className='flex justify-end space-x-2'>
            <Button
              variant='outline'
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!file || isLoading}>
              {isLoading ? 'Procesando...' : 'Importar usuarios'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
