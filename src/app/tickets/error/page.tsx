import { AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Page() {
  return (
    <div className='flex justify-center items-center h-main-screen pb-64'>
      <Card className='max-w-md w-full text-center shadow-lg'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold text-destructive flex items-center justify-center gap-2'>
            <AlertTriangle className='w-6 h-6' />
            Ha ocurrido un error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground'>
            Algo salió mal, probablemente durante el proceso de pago. Intentá
            nuevamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
