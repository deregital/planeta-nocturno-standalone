'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useActionState, useEffect, useState } from 'react';
import esPhoneLocale from 'react-phone-number-input/locale/es';

import { handlePurchase } from '@/app/(client)/checkout/action';
import { TicketGroupTable } from '@/components/checkout/TicketGroupTable';
import GoBack from '@/components/common/GoBack';
import InputWithLabel from '@/components/common/InputWithLabel';
import PhoneInputWithLabel from '@/components/common/PhoneInputWithLabel';
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
      <div className='flex justify-baseline w-full'>
        <GoBack />
      </div>
      <div className='flex flex-col px-4 w-full sm:w-xl md:w-2xl'>
        <p className='text-2xl'>{ticketGroup.event.name}</p>
        <p className='text-lg font-medium text-accent'>
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
                error={
                  typeof state.errors === 'object' && state.errors !== null
                    ? (state.errors as Record<string, string>)[
                        `fullName_${ticket.ticketType.id}-${indexAmount}`
                      ]
                    : undefined
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
                error={
                  typeof state.errors === 'object' && state.errors !== null
                    ? (state.errors as Record<string, string>)[
                        `mail_${ticket.ticketType.id}-${indexAmount}`
                      ]
                    : undefined
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
                error={
                  typeof state.errors === 'object' && state.errors !== null
                    ? (state.errors as Record<string, string>)[
                        `dni_${ticket.ticketType.id}-${indexAmount}`
                      ]
                    : undefined
                }
              />

              <div className='flex flex-col gap-1'>
                <PhoneInputWithLabel
                  label='Número de teléfono'
                  name={`phoneNumber_${ticket.ticketType.id}-${indexAmount}`}
                  id={`phoneNumber_${ticket.ticketType.id}-${indexAmount}`}
                  labels={esPhoneLocale}
                  defaultCountry='AR'
                  className='[&_[data-slot="input"]]:border-stroke'
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
                  required
                  error={
                    typeof state.errors === 'object' && state.errors !== null
                      ? (state.errors as Record<string, string>)[
                          `phoneNumber_${ticket.ticketType.id}-${indexAmount}`
                        ]
                      : undefined
                  }
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
                error={
                  typeof state.errors === 'object' && state.errors !== null
                    ? (state.errors as Record<string, string>)[
                        `birthDate_${ticket.ticketType.id}-${indexAmount}`
                      ]
                    : undefined
                }
              />
              <div className='flex flex-col gap-1'>
                <Label
                  className='pl-1 text-accent gap-0.5'
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
                  <SelectTrigger className='w-full py-2 border-stroke'>
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
                {typeof state.errors === 'object' &&
                  state.errors !== null &&
                  (state.errors as Record<string, string>)[
                    `gender_${ticket.ticketType.id}-${indexAmount}`
                  ] && (
                    <p className='pl-1 font-bold text-xs text-red-500'>
                      {
                        (state.errors as Record<string, string>)[
                          `gender_${ticket.ticketType.id}-${indexAmount}`
                        ]
                      }
                    </p>
                  )}
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
                error={
                  typeof state.errors === 'object' && state.errors !== null
                    ? (state.errors as Record<string, string>)[
                        `instagram_${ticket.ticketType.id}-${indexAmount}`
                      ]
                    : undefined
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
                <Separator className='my-6 bg-accent-dark/70' />
              )}
            </div>
          ));
        })}
        <Separator className='mt-12 mb-6 bg-accent-dark/70' />
        <InputWithLabel
          name={'invitedBy'}
          id={'invitedBy'}
          label='Invita... (ingresar el nombre del pública)'
          type='text'
          placeholder='ej. Pablo Perez'
          error={
            typeof state.errors === 'object' && state.errors !== null
              ? (state.errors as Record<string, string>)['invitedBy']
              : undefined
          }
          className='[&>input]:border-dashed'
        />

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
