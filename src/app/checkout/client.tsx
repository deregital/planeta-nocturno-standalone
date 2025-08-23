'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useActionState, useEffect, useState } from 'react';
import PhoneInput from 'react-phone-number-input';
import esPhoneLocale from 'react-phone-number-input/locale/es';

import { TicketGroupTable } from '@/components/checkout/TicketGroupTable';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { type RouterOutputs } from '@/server/routers/app';
import { handlePurchase } from '@/app/checkout/action';
import 'react-phone-number-input/style.css';

export default function CheckoutClient({
  ticketGroup,
}: {
  ticketGroup: RouterOutputs['ticketGroup']['getById'];
}) {
  const [state, action, isPending] = useActionState(handlePurchase, {
    ticketsInput: [],
  });

  const [phoneNumbers, setPhoneNumbers] = useState<Record<string, string>>({});

  // Initialize phone numbers from state if available
  useEffect(() => {
    if (state.formData) {
      const newPhoneNumbers: Record<string, string> = {};
      Object.entries(state.formData).forEach(([key, value]) => {
        if (key.startsWith('phoneNumber_')) {
          newPhoneNumbers[key] = value;
        }
      });
      setPhoneNumbers(newPhoneNumbers);
    }
  }, [state.formData]);

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

  return (
    <div className='flex flex-col justify-center items-center gap-6 pb-16 mx-8 my-6'>
      <div className='flex flex-col px-4 w-full sm:w-xl md:w-2xl'>
        <p className='text-2xl'>{ticketGroup.event.name}</p>
        <p className='text-lg font-medium text-pn-accent'>
          {formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}
        </p>
      </div>

      <TicketGroupTable ticketGroup={ticketGroup} />

      <form
        action={action}
        className='flex flex-col px-4 w-full sm:w-xl md:w-2xl'
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
                defaultValue={
                  state.formData?.[
                    `fullName_${ticket.ticketType.id}-${indexAmount}`
                  ]
                }
              />
              <InputWithLabel
                name={`mail_${ticket.ticketType.id}-${indexAmount}`}
                id={`mail_${ticket.ticketType.id}-${indexAmount}`}
                label='Mail'
                type='email'
                required
                defaultValue={
                  state.formData?.[
                    `mail_${ticket.ticketType.id}-${indexAmount}`
                  ]
                }
              />
              <InputWithLabel
                name={`dni_${ticket.ticketType.id}-${indexAmount}`}
                id={`dni_${ticket.ticketType.id}-${indexAmount}`}
                label='DNI'
                type='text'
                required
                defaultValue={
                  state.formData?.[`dni_${ticket.ticketType.id}-${indexAmount}`]
                }
              />

              <div className='flex flex-col gap-1'>
                <Label
                  className='pl-1 text-pn-accent gap-0.5'
                  htmlFor={`phoneNumber_${ticket.ticketType.id}-${indexAmount}`}
                >
                  Número de teléfono<span className='text-red-500'>*</span>
                </Label>
                <PhoneInput
                  labels={esPhoneLocale}
                  defaultCountry='AR'
                  className='[&_[data-slot="input"]]:border-pn-gray'
                  inputComponent={Input}
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
                defaultValue={
                  state.formData?.[
                    `birthDate_${ticket.ticketType.id}-${indexAmount}`
                  ]
                }
              />
              <div className='flex flex-col gap-1'>
                <Label
                  className='pl-1 text-pn-accent gap-0.5'
                  htmlFor={`gender_${ticket.ticketType.id}-${indexAmount}`}
                >
                  Género<span className='text-red-500'>*</span>
                </Label>
                <Select
                  name={`gender_${ticket.ticketType.id}-${indexAmount}`}
                  required
                  defaultValue={
                    state.formData?.[
                      `gender_${ticket.ticketType.id}-${indexAmount}`
                    ]
                  }
                >
                  <SelectTrigger className='w-full py-2 border-pn-gray'>
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
                defaultValue={
                  state.formData?.[
                    `instagram_${ticket.ticketType.id}-${indexAmount}`
                  ]
                }
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
          size='lg'
          variant='accent'
          className='rounded-full sm:text-2xl text-xl font-bold py-6 mt-8'
          disabled={isPending}
        >
          <span>COMPRAR</span>
        </Button>
      </form>
    </div>
  );
}
