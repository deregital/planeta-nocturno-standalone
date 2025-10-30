import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ServerErrorCard({
  title = 'Ha ocurrido un error',
  description = 'Hubo un error al realizar la acción. Intentá nuevamente.',
  route = '/',
}: {
  title?: string;
  description?: string;
  route?: string;
}) {
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
        <CardFooter>
          <Link href={route} className='w-full'>
            <Button className='w-full h-10'>Volver</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
