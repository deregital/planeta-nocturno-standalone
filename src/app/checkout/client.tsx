'use client';
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
import { type RouterOutputs } from '@/server/routers/app';
import { useActionState } from 'react';

export default function CheckoutClient({
  ticketGroup,
}: {
  ticketGroup: RouterOutputs['ticketGroup']['getById'];
}) {
  const [state, action, isPending] = useActionState(handlePurchase, {
    ticketsInput: [],
  });

  return (
    <div className='flex flex-col justify-center  items-center gap-6'>
      <div className='flex flex-col justify-center gap-4 p-6'>
        <p className='text-4xl'>{ticketGroup.event.name}</p>
        <p className='text-2xl'>
          {format(
            new Date(ticketGroup.event.startingDate),
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
          {ticketGroup.ticketTypePerGroups.map((ticket) => (
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
      <form action={action} className='flex flex-col gap-4 mx-auto w-1/2'>
        {ticketGroup.ticketTypePerGroups.map((ticket, indexType) => {
          return Array.from({ length: ticket.amount }).map((_, indexAmount) => (
            <div
              key={ticket.ticketType.id + '-' + indexAmount}
              className='flex flex-col'
            >
              <p className='text-3xl'>
                Entrada {ticket.ticketType.name} {indexAmount + 1}
              </p>
              <label
                htmlFor={`fullName_${ticket.ticketType.id}-${indexAmount}`}
              >
                Nombre completo
              </label>
              <Input
                type='text'
                name={`fullName_${ticket.ticketType.id}-${indexAmount}`}
                required
                className='border border-gray-300 rounded p-2'
              />
              <label htmlFor={`mail_${ticket.ticketType.id}-${indexAmount}`}>
                Mail
              </label>
              <Input
                type='email'
                name={`mail_${ticket.ticketType.id}-${indexAmount}`}
                required
                className='border border-gray-300 rounded p-2'
              />
              <label htmlFor={`dni_${ticket.ticketType.id}-${indexAmount}`}>
                DNI
              </label>
              <Input
                type='text'
                name={`dni_${ticket.ticketType.id}-${indexAmount}`}
                required
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
                    <SelectLabel>Género</SelectLabel>
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

        {state.errors && (
          <p className='text-red-500 font-bold'>{state.errors[0]}</p>
        )}
        <input hidden name='eventId' defaultValue={ticketGroup.eventId} />
        <input hidden name='ticketGroupId' defaultValue={ticketGroup.id} />
        <Button type='submit' disabled={isPending}>
          Comprar
        </Button>
      </form>
    </div>
  );
}
