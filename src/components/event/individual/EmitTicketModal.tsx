'use client';

import { Ticket } from 'lucide-react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import PhoneInput from 'react-phone-number-input';
import { toast } from 'sonner';
import z from 'zod';

import { PHONE_COUNTRY_LABELS as esPhoneLocale } from '@/lib/phone-labels';
import { emitTicket } from '@/app/(backoffice)/admin/event/[slug]/actions';
import { FormRow } from '@/components/common/FormRow';
import InputDateWithLabel from '@/components/common/InputDateWithLabel';
import InputWithLabel from '@/components/common/InputWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type genderTranslation } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';
import { createTicketSchema } from '@/server/schemas/emitted-tickets';
import { trpc } from '@/server/trpc/client';
import 'react-phone-number-input/style.css';

export function EmitTicketModal({
  event,
}: {
  event: RouterOutputs['events']['getBySlug'];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<Record<string, string>>({});
  const [emitTicketLoading, setEmitTicketLoading] = useState(false);
  // Vacíos: con 'Masculino' por defecto se guardaba un género que nadie
  // eligió, y la fecha de hoy precargada nunca pasaba la validación.
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [gender, setGender] = useState<keyof typeof genderTranslation | ''>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState('');

  const utils = trpc.useUtils();

  // Entradas tomadas por tipo, para mostrar cuántas quedan al elegir.
  const takenByType = useMemo(() => {
    const taken = new Map<string, number>();
    for (const group of event?.ticketGroups ?? []) {
      for (const ticket of group.emittedTickets) {
        taken.set(
          ticket.ticketTypeId,
          (taken.get(ticket.ticketTypeId) ?? 0) + 1,
        );
      }
    }
    return taken;
  }, [event?.ticketGroups]);

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
      birthDate: birthDate ?? '',
      mail: formData.get('mail') as string,
      dni: formData.get('dni') as string,
      eventId: event!.id,
      fullName: formData.get('fullName') as string,
      gender: gender,
      phoneNumber: phoneNumber,
      paidOnLocation: formData.get('paidOnLocation') === 'on',
      ticketTypeId: selectedTicketTypeId,
      instagram: (formData.get('instagram') as string) || undefined,
      alreadyEntered: formData.get('alreadyEntered') === 'on',
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
    let result = await emitTicket(validation.data);
    if (
      !result.ok &&
      result.overQuota &&
      window.confirm(`${result.message} ¿Emitir igual, por encima del cupo?`)
    ) {
      result = await emitTicket({ ...validation.data, allowOverQuota: true });
    }
    if (!result.ok) {
      setEmitTicketLoading(false);
      if (!result.overQuota) toast.error(result.message);
      return;
    }
    posthog.capture('ticket_emitted', {
      event_id: ticketData.eventId,
      ticket_category: selectedTicketType?.category,
      paid_on_location: ticketData.paidOnLocation,
    });
    setEmitTicketLoading(false);

    setOpen(false);
    setError({});
    setPhoneNumber('');
    setBirthDate(null);
    setGender('');
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
        <Button className='flex gap-x-5 w-full' variant='outline'>
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
                label='Nombre y apellido'
                id='name'
                name='fullName'
                defaultValue=''
                required={true}
                error={error.fullName}
              />
            </FormRow>
            <FormRow>
              <InputWithLabel
                label='DNI/Pasaporte'
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
                  className='pl-1 text-accent gap-0.5'
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
                    '[&_[data-slot="input"]]:border-stroke',
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
                value={gender}
                values={[
                  { label: 'Masculino', value: 'male' },
                  { label: 'Femenino', value: 'female' },
                  { label: 'Otro', value: 'other' },
                ]}
                onValueChange={(value) => {
                  setGender(value as keyof typeof genderTranslation);
                }}
                required={true}
                error={error.gender}
              />
              <input type='hidden' name='gender' value={gender} />
              <InputDateWithLabel
                label='Fecha de nacimiento'
                id='birthDate'
                selected={birthDate}
                onChange={(date) => setBirthDate(date)}
                required={true}
                error={error.birthDate}
              />
            </FormRow>

            <FormRow>
              <div className='flex flex-col min-w-0'>
                <SelectWithLabel
                  className='w-full'
                  label='Tipo de ticket'
                  id='ticketTypeId'
                  name='ticketTypeId'
                  defaultValue=''
                  values={event!.ticketTypes.map((type) => {
                    const left =
                      type.maxAvailable - (takenByType.get(type.id) ?? 0);
                    return {
                      label: `${type.name} - $${type.price} (${left > 0 ? `quedan ${left}` : 'sin cupo'})`,
                      value: type.id,
                    };
                  })}
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
                <Link
                  href={`/admin/event/edit/${event?.slug}`}
                  className='text-sm text-accent hover:underline'
                >
                  Crear nuevo tipo de ticket
                </Link>
              </div>
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
            <FormRow>
              <InputWithLabel
                className='[&_[data-slot="input"]]:w-7 [&_[data-slot="input"]]:ml-1'
                type='checkbox'
                label='Ya ingresó (venta en la puerta)'
                id='alreadyEntered'
                name='alreadyEntered'
                defaultChecked={false}
              />
            </FormRow>
            <p className='text-xs text-muted-foreground'>
              Si la persona no está en la puerta, dejalo destildado: el QR que
              le llega por mail sirve para entrar.
            </p>
            <Button type='submit' loading={emitTicketLoading}>
              Emitir ticket
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
