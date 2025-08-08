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
import React, { useActionState, useState } from 'react';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Label } from '@/components/ui/label';
import { ticketTypePerGroup } from '@/drizzle/schema';
import { Separator } from '@/components/ui/separator';

export default function CheckoutClient({
  ticketGroup,
}: {
  ticketGroup: RouterOutputs['ticketGroup']['getById'];
}) {
  const [state, action, isPending] = useActionState(handlePurchase, {
    ticketsInput: [],
  });

  const [phoneNumbers, setPhoneNumbers] = useState<Record<string, string>>({});

  const handlePhoneNumberChange = (key: string, value: string) => {
    setPhoneNumbers((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const formattedDate = format(
    new Date(ticketGroup.event.startingDate),
    "EEEE d 'de' MMMM 'de' yyyy - HH:mm 'hrs.'",
    { locale: es },
  );

  const totalPrice = ticketGroup.ticketTypePerGroups
    .reduce((acc, type) => acc + (type.ticketType.price || 0) * type.amount, 0)
    .toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/\s/g, '');

  return (
    <div className='flex flex-col justify-center items-center gap-6 pb-16 mx-8 my-6'>
      <div className='flex flex-col px-4 w-full sm:w-xl md:w-2xl'>
        <p className='text-2xl'>{ticketGroup.event.name}</p>
        <p className='text-lg font-medium text-pn-accent'>
          {formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}
        </p>
      </div>

      <div className='flex flex-col justify-center items-center border border-pn-gray p-4 rounded-sm w-full sm:w-xl md:w-2xl'>
        {/* Encabezado de la tabla */}
        <div className='grid grid-cols-3 pb-[4px] pt-4 border-b border-pn-gray w-full text-lg leading-[100%]'>
          <div className='text-pn-text-primary'>Tipo de Ticket</div>
          <div className='text-pn-text-primary text-center'>Valor</div>
          <div className='text-pn-text-primary text-right'>Cantidad</div>
        </div>
        {/* Fila de ticket */}
        <div className='grid grid-cols-3 py-6 gap-4 items-center w-full'>
          {ticketGroup.ticketTypePerGroups.map((type, index) => {
            return (
              <React.Fragment key={index}>
                <div className='text-pn-text-primary leading-[100%]'>
                  {type.ticketType.name}
                </div>
                <div className='text-pn-text-primary leading-[100%] text-center'>
                  {type.ticketType.price ? (
                    <p>${type.ticketType.price}</p>
                  ) : (
                    <p className='text-green-700'>GRATUITO</p>
                  )}
                </div>
                <div className='text-pn-text-primary leading-[100%] text-center'>
                  {type.amount}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <p className='w-full text-start text-lg mt-6'>Total: {totalPrice}</p>
      </div>

      <form
        action={action}
        className='flex flex-col gap-8 px-4 w-full sm:w-xl md:w-2xl mt-8'
      >
        {ticketGroup.ticketTypePerGroups.map((ticket, ticketTypeIndex) => {
          return Array.from({ length: ticket.amount }).map((_, indexAmount) => (
            <div
              key={ticket.ticketType.id + '-' + indexAmount}
              className='flex flex-col gap-4'
            >
              {(ticketGroup.ticketTypePerGroups.length !== 1 ||
                ticket.amount !== 1) && (
                <p className='text-3xl font-extralight py-2'>
                  Entrada {ticket.ticketType.name} {indexAmount + 1}
                </p>
              )}
              <InputWithLabel
                name={`fullName_${ticket.ticketType.id}-${indexAmount}`}
                id={`fullName_${ticket.ticketType.id}-${indexAmount}`}
                label='Nombre completo'
                required
              />
              <InputWithLabel
                name={`mail_${ticket.ticketType.id}-${indexAmount}`}
                id={`mail_${ticket.ticketType.id}-${indexAmount}`}
                label='Mail'
                type='email'
                required
              />
              <InputWithLabel
                name={`dni_${ticket.ticketType.id}-${indexAmount}`}
                id={`dni_${ticket.ticketType.id}-${indexAmount}`}
                label='DNI'
                type='text'
                required
              />

              <div className='flex flex-col gap-1'>
                <Label
                  className='pl-1 text-pn-accent gap-[2px]'
                  htmlFor={`phoneNumber_${ticket.ticketType.id}-${indexAmount}`}
                >
                  Número de teléfono<span className='text-red-500'>*</span>
                </Label>
                <PhoneInput
                  className='py-[20px] border-pn-gray file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
                  defaultCountry='AR'
                  value={
                    phoneNumbers[
                      `phoneNumber_${ticket.ticketType.id}-${indexAmount}`
                    ]
                  }
                  onChange={(v) => {
                    if (v)
                      handlePhoneNumberChange(
                        `phoneNumber_${ticket.ticketType.id}-${indexAmount}`,
                        v?.toString(),
                      );
                  }}
                />
              </div>
              <input
                hidden
                name={`phoneNumber_${ticket.ticketType.id}-${indexAmount}`}
                value={
                  phoneNumbers[
                    `phoneNumber_${ticket.ticketType.id}-${indexAmount}`
                  ] ?? ''
                }
                onChange={() => {}}
              />
              <InputWithLabel
                name={`birthDate_${ticket.ticketType.id}-${indexAmount}`}
                id={`birthDate_${ticket.ticketType.id}-${indexAmount}`}
                label='Fecha de nacimiento'
                type='date'
                required
                max={format(new Date(), 'yyyy-MM-dd')}
                suppressHydrationWarning
              />
              <div className='flex flex-col gap-1'>
                <Label
                  className='pl-1 text-pn-accent gap-[2px]'
                  htmlFor={`gender_${ticket.ticketType.id}-${indexAmount}`}
                >
                  Género<span className='text-red-500'>*</span>
                </Label>
                <Select
                  name={`gender_${ticket.ticketType.id}-${indexAmount}`}
                  required
                >
                  <SelectTrigger className='w-full py-[20px] border-pn-gray'>
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
              </div>
              <InputWithLabel
                name={`instagram_${ticket.ticketType.id}-${indexAmount}`}
                id={`instagram_${ticket.ticketType.id}-${indexAmount}`}
                label='Instagram'
                type='text'
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
              {(indexAmount < ticket.amount - 1 ||
                ticketTypeIndex <
                  ticketGroup.ticketTypePerGroups.length - 1) && (
                <Separator className='my-6 bg-pn-gray' />
              )}
            </div>
          ));
        })}

        {state.errors && (
          <p className='text-red-500 font-bold'>{state.errors[0]}</p>
        )}
        <input hidden name='eventId' defaultValue={ticketGroup.eventId} />
        <input hidden name='ticketGroupId' defaultValue={ticketGroup.id} />
        <Button
          type='submit'
          className='bg-pn-accent rounded-full text-2xl font-bold py-7 hover:bg-pn-accent/90 cursor-pointer'
          disabled={isPending}
        >
          COMPRAR
        </Button>
      </form>
    </div>
  );
}
