import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Ghost } from 'lucide-react';

export default function NotFound() {
  return (
    <div className='flex justify-center items-center h-main-screen pb-64'>
      <Card className='max-w-md w-full text-center shadow-lg'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold flex items-center justify-center gap-2'>
            <Ghost className='w-6 h-6 text-muted-foreground' />
            Entradas no encontrada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground'>
            La entrada que buscás no existe. Asegurate de que el enlace sea
            correcto o volvé a intentarlo desde la página principal.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
