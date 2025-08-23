'use client';

import { Ticket } from 'lucide-react';
import esPhoneLocale from 'react-phone-number-input/locale/es';
import PhoneInput from 'react-phone-number-input';
import { useMemo, useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import z from 'zod';

import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputDateWithLabel from '@/components/common/InputDateWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { cn } from '@/lib/utils';
import { emitTicket } from '@/app/admin/event/[slug]/actions';
import { createTicketSchema } from '@/server/schemas/emitted-tickets';
import 'react-phone-number-input/style.css';

export function EmitTicketModal({
  event,
}: {
  event: RouterOutputs['events']['getBySlug'];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<Record<string, string>>({});
  const [emitTicketLoading, setEmitTicketLoading] = useState(false);
  const [birthDate, setBirthDate] = useState(new Date());
  const [phoneNumber, setPhoneNumber] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState('');

  const utils = trpc.useUtils();
  const selectedTicketType = useMemo(() => {
    if (!selectedTicketTypeId) return undefined;
    const ticketType = event?.ticketTypes.find(
      (type) => type.id === selectedTicketTypeId,
    );
    return ticketType;
  }, [event?.ticketTypes, selectedTicketTypeId]);

  // Handle automatic paidOnLocation update when ticket type changes
  useEffect(() => {
    if (selectedTicketType?.category === 'FREE') {
      const paidOnLocationInput = formRef.current?.querySelector(
        '[name="paidOnLocation"]',
      ) as HTMLInputElement;
      if (paidOnLocationInput) {
        paidOnLocationInput.checked = false;
      }
    }
  }, [selectedTicketType?.category]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const ticketData = {
      birthDate: birthDate,
      mail: formData.get('mail') as string,
      dni: formData.get('dni') as string,
      eventId: event!.id,
      fullName: formData.get('fullName') as string,
      gender: formData.get('gender') as 'male' | 'female' | 'other',
      phoneNumber: phoneNumber,
      paidOnLocation: formData.get('paidOnLocation') === 'on',
      ticketTypeId: selectedTicketTypeId,
      instagram: (formData.get('instagram') as string) || undefined,
    };

    const validation = createTicketSchema.safeParse(ticketData);

    if (!validation.success) {
      const error = z.treeifyError(validation.error);
      setError(
        Object.fromEntries(
          Object.entries(error?.properties ?? {}).map(([key, value]) => [
            key,
            value.errors?.[0] ?? '',
          ]),
        ),
      );
      return;
    }

    setEmitTicketLoading(true);
    await emitTicket(ticketData);
    setEmitTicketLoading(false);

    setOpen(false);
    setError({});
    setPhoneNumber('');
    setBirthDate(new Date());
    setSelectedTicketTypeId('');
    formRef.current?.reset();
    utils.emittedTickets.getByEventId.invalidate({
      eventId: event!.id,
    });
    toast.success('Ticket emitido correctamente');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) {
          setError({});
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className='flex gap-x-5' variant='outline'>
          Emitir ticket
          <Ticket className='size-5' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className='text-lg font-semibold'>
          Emitir ticket para {event?.name}
        </DialogTitle>
        <DialogDescription hidden>Emision manual de ticket</DialogDescription>
        <div>
          <form
            ref={formRef}
            className='flex flex-col gap-3'
            onSubmit={handleSubmit}
          >
            <FormRow>
              <InputWithLabel
                label='Nombre completo'
                id='name'
                name='fullName'
                defaultValue=''
                required={true}
                error={error.fullName}
              />
            </FormRow>
            <FormRow>
              <InputWithLabel
                label='DNI'
                id='dni'
                name='dni'
                defaultValue=''
                required={true}
                error={error.dni}
              />
              <InputWithLabel
                label='Email'
                id='email'
                name='mail'
                type='email'
                defaultValue=''
                required={true}
                error={error.mail}
              />
            </FormRow>

            <FormRow>
              <div className='flex flex-col gap-1'>
                <Label
                  className='pl-1 text-pn-accent gap-0.5'
                  htmlFor={`phoneNumber`}
                >
                  Número de teléfono<span className='text-red-500'>*</span>
                </Label>
                <PhoneInput
                  value={phoneNumber}
                  onChange={(v) => {
                    setPhoneNumber(v || '');
                  }}
                  labels={esPhoneLocale}
                  defaultCountry='AR'
                  className={cn(
                    '[&_[data-slot="input"]]:border-pn-gray',
                    error.phoneNumber &&
                      '[&_[data-slot="input"]]:border-red-500 [&_[data-slot="input"]]:border-2',
                  )}
                  inputComponent={Input}
                  error={error.phoneNumber}
                />
                {error.phoneNumber && (
                  <p className='pl-1 font-bold text-xs text-red-500'>
                    {error.phoneNumber}
                  </p>
                )}
              </div>
              <InputWithLabel
                label='Instagram'
                id='instagram'
                name='instagram'
                defaultValue=''
                error={error.instagram}
              />
            </FormRow>
            <FormRow>
              <SelectWithLabel
                className='w-full'
                label='Género'
                id='gender'
                name='gender'
                defaultValue='male'
                values={[
                  { label: 'Masculino', value: 'male' },
                  { label: 'Femenino', value: 'female' },
                  { label: 'Otro', value: 'other' },
                ]}
                onValueChange={(value) => {
                  const select = formRef.current?.querySelector(
                    '[name="gender"]',
                  ) as HTMLSelectElement;
                  if (select) {
                    select.value = value;
                  }
                }}
                required={true}
                error={error.gender}
              />
              <InputDateWithLabel
                label='Fecha de nacimiento'
                id='birthDate'
                selected={birthDate}
                onChange={(date) => {
                  if (date) {
                    setBirthDate(date);
                  }
                }}
                required={true}
                error={error.birthDate}
              />
            </FormRow>

            <FormRow>
              <SelectWithLabel
                className='w-full'
                label='Tipo de entrada'
                id='ticketTypeId'
                name='ticketTypeId'
                defaultValue=''
                values={event!.ticketTypes.map((type) => ({
                  label: `${type.name} - $${type.price}`,
                  value: type.id,
                }))}
                onValueChange={(value) => {
                  setSelectedTicketTypeId(value);
                  const select = formRef.current?.querySelector(
                    '[name="ticketTypeId"]',
                  ) as HTMLSelectElement;
                  if (select) {
                    select.value = value;
                  }
                }}
                required={true}
                error={error.ticketTypeId}
              />
              <InputWithLabel
                className='[&_[data-slot="input"]]:w-7 [&_[data-slot="input"]]:ml-1'
                type='checkbox'
                label='Pagada en local?'
                id='paidOnLocation'
                name='paidOnLocation'
                disabled={selectedTicketType?.category === 'FREE'}
                defaultChecked={true}
                error={error.paidOnLocation}
              />
            </FormRow>

            <Button type='submit' disabled={emitTicketLoading}>
              Emitir ticket
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormRow({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex flex-row gap-3 items-start w-full [&>*]:flex-1'>
      {children}
    </div>
  );
}
