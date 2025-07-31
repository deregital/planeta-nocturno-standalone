import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc } from '@/server/trpc/server';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { handlePurchase } from './action';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default async function CheckoutPage() {
  const ticketGroupId = (await cookies()).get('carrito');

  if (!ticketGroupId) {
    redirect('/');
  }
  const data = await trpc.ticketGroup.getById(ticketGroupId.value);
  return (
    <div className='flex flex-col justify-center  items-center gap-6'>
      <div className='flex flex-col justify-center gap-4 p-6'>
        <p className='text-4xl'>{data.event.name}</p>
        <p className='text-2xl'>
          {format(
            new Date(data.event.startingDate),
            "EEEE d 'de' MMMM 'de' yyyy - HH:mm 'hrs.'",
            { locale: es },
          )}
        </p>
      </div>
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
        </TableBody>
      </Table>
      <form
        action={handlePurchase}
        className='flex flex-col gap-4 mx-auto w-1/2'
      >
        {data.ticketTypePerGroups.map((ticket, indexType) => {
          return Array.from({ length: ticket.amount }).map((_, indexAmount) => (
            <div
              key={ticket.ticketType.id + '-' + indexAmount}
              className='flex flex-col'
            >
              <p className='text-3xl'>
                Entrada {ticket.ticketType.name} {indexAmount + 1}
              </p>
              <label
                htmlFor={`fullName-${ticket.ticketType.id}_${indexType}${indexAmount}`}
              >
                Nombre completo
              </label>
              <Input
                type='text'
                name={`fullName_${ticket.ticketType.id}-${indexAmount}`}
                required
                defaultValue='Nombre completo'
                className='border border-gray-300 rounded p-2'
              />
              <label
                htmlFor={`mail-${ticket.ticketType.id}-${indexType}${indexAmount}`}
              >
                Mail
              </label>
              <Input
                type='email'
                name={`mail_${ticket.ticketType.id}-${indexAmount}`}
                required
                defaultValue='a@gmail.com'
                className='border border-gray-300 rounded p-2'
              />
              <label htmlFor={`dni_${ticket.ticketType.id}-${indexAmount}`}>
                DNI
              </label>
              <Input
                type='text'
                name={`dni_${ticket.ticketType.id}-${indexAmount}`}
                required
                defaultValue='12345678'
                className='border border-gray-300 rounded p-2'
              />
              <label
                htmlFor={`phoneNumber_${ticket.ticketType.id}-${indexAmount}`}
              >
                Numero de teléfono
              </label>
              <Input
                type='text'
                name={`phoneNumber_${ticket.ticketType.id}-${indexAmount}`}
                required
                defaultValue='+54'
                className='border border-gray-300 rounded p-2'
              />
              <label
                htmlFor={`birthDate_${ticket.ticketType.id}-${indexAmount}`}
              >
                Fecha de nacimiento
              </label>
              <Input
                type='date'
                name={`birthDate_${ticket.ticketType.id}-${indexAmount}`}
                defaultValue={'2015-01-01'}
                required
                className='border border-gray-300 rounded p-2'
              />
              <label htmlFor={`gender_${ticket.ticketType.id}-${indexAmount}`}>
                Genero
              </label>
              <Select
                name={`gender_${ticket.ticketType.id}-${indexAmount}`}
                required
              >
                <SelectTrigger className='w-[180px]'>
                  <SelectValue placeholder='Selecciona tu género' />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Fruits</SelectLabel>
                    <SelectItem value='male'>Masculino</SelectItem>
                    <SelectItem value='female'>Femenino</SelectItem>
                    <SelectItem value='other'>Otro</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <label
                htmlFor={`instagram_${ticket.ticketType.id}-${indexAmount}`}
              >
                Instagram
              </label>
              <Input
                type='text'
                name={`instagram_${ticket.ticketType.id}-${indexAmount}`}
                className='border border-gray-300 rounded p-2'
                placeholder='@'
              />
              <input
                type='hidden'
                name={`ticketTypeId_${ticket.ticketType.id}-${indexAmount}`}
                value={ticket.ticketType.id}
              />
              <input
                type='hidden'
                name={`ticketGroupId_${ticket.ticketType.id}-${indexAmount}`}
                value={ticket.ticketGroupId}
              />
            </div>
          ));
        })}

        <input hidden name='eventId' defaultValue={data.eventId} />
        <input hidden name='ticketGroupId' defaultValue={data.id} />
        <Button type='submit'>Comprar</Button>
      </form>
    </div>
  );

  // <pre>{JSON.stringify(data, null, 2)}</pre>;
}
