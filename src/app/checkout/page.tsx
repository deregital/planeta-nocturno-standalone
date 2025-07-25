import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc } from '@/server/trpc/server';
import { cookies } from 'next/headers';
import Image from 'next/image';
import { redirect } from 'next/navigation';

export default async function CheckoutPage() {
  // Aggarrraraara cookie (id)
  const ticketGroupId = (await cookies()).get('carrito');

  if (!ticketGroupId) {
    redirect('/');
  }
  // sacar la data de con datos de tickettypes y groups
  // getDataById
  // nombre ticket precio cantidad total (precio *cantidad)
  const data = await trpc.ticketGroup.getById(ticketGroupId.value);
  // mostrarlo

  return (
    <div className='flex flex-col justify-center gap-6'>
      <Card className='w-3/4 mx-auto'>
        <CardHeader>
          <CardTitle>{data.event.name}</CardTitle>
          <CardDescription>{data.event.description}</CardDescription>
          <Image
            src={data.event.coverImageUrl}
            width={200}
            height={300}
            alt={`Imagen de portada del evento ${data.event.name}`}
          />
        </CardHeader>
      </Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='text-center'>Nombre</TableHead>
            <TableHead className='text-center'>Precio</TableHead>
            <TableHead className='text-center'>Cantidad</TableHead>
            <TableHead className='text-center'>subTotal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.ticketTypePerGroups.map((ticket) => (
            <TableRow key={ticket.ticketType.id}>
              <TableCell className='text-center'>
                {ticket.ticketType.name}
              </TableCell>
              <TableCell className='text-center'>
                {ticket.ticketType.price}
              </TableCell>
              <TableCell className='text-center'>{ticket.amount}</TableCell>
              <TableCell className='text-center'>
                {ticket.ticketType.price
                  ? ticket.amount * ticket.ticketType.price
                  : 'Liberada'}
              </TableCell>
            </TableRow>
          ))}
          <TableRow></TableRow>
        </TableBody>
      </Table>
    </div>
  );

  // <pre>{JSON.stringify(data, null, 2)}</pre>;
}
