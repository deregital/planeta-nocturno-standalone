'use client';
import { type Route } from 'next';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ErrorCard({
  title = 'Ha ocurrido un error',
  description = 'Hubo un error al realizar la acción. Intentá nuevamente.',
  route,
  children,
}: {
  title?: string;
  description?: string;
  route?: Route;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className='flex justify-center items-center h-main-screen'>
      <Card className='max-w-md w-full text-center shadow-lg m-4'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold flex items-center justify-center gap-2 text-accent'>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground'>{description}</p>
        </CardContent>
        {children ? (
          <CardFooter className='flex justify-center w-full h-10'>
            {children}
          </CardFooter>
        ) : (
          <CardFooter>
            <Button
              onClick={() => (route ? router.push(route) : router.back())}
              className='w-full h-10'
            >
              Volver
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
