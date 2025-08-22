'use client';

import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { type RouterOutputs } from '@/server/routers/app';
import { Ticket } from 'lucide-react';
import { trpc } from '@/server/trpc/client';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Label } from '@/components/ui/label';
import esPhoneLocale from 'react-phone-number-input/locale/es';
import PhoneInput from 'react-phone-number-input';
import { Input } from '@/components/ui/input';
import { useMemo, useState, useRef, useEffect } from 'react';
import 'react-phone-number-input/style.css';
import InputDateWithLabel from '@/components/common/InputDateWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function EmitTicketModal({
  event,
}: {
  event: RouterOutputs['events']['getBySlug'];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<Record<string, string>>({});
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

  const emitTicketMutation = trpc.emittedTickets.create.useMutation({
    onError: (error) => {
      if (error.data?.zodError) {
        const props = Object.entries(
          (
            error.data.zodError as unknown as {
              properties: Record<string, { errors: string[] }>;
            }
          ).properties,
        ).map(([key, value]) => [key, value.errors[0] ?? '']);

        setError(Object.fromEntries(props) as Record<string, string>);
      } else {
        setError({});
      }
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      ticketTypeId: formData.get('ticketTypeId') as string,
      instagram: (formData.get('instagram') as string) || undefined,
    };

    emitTicketMutation.mutate(ticketData, {
      onSuccess: () => {
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
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} modal={true}>
      <DialogTrigger asChild>
        <Button className='flex gap-x-5' variant='outline'>
          Emitir ticket
          <Ticket className='size-5' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className='text-lg font-semibold'>
          Escanear ticket
        </DialogTitle>
        <div>
          <form
            ref={formRef}
            className='flex flex-col gap-3'
            onSubmit={handleSubmit}
          >
            <InputWithLabel
              label='Nombre completo'
              id='name'
              name='fullName'
              defaultValue=''
              required={true}
              error={error.fullName}
            />
            <InputWithLabel
              label='DNI'
              id='dni'
              name='dni'
              defaultValue=''
              required={true}
              error={error.dni}
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
            <InputWithLabel
              label='Email'
              id='email'
              name='mail'
              type='email'
              defaultValue=''
              required={true}
              error={error.mail}
            />
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
            <InputWithLabel
              label='Instagram'
              id='instagram'
              name='instagram'
              defaultValue=''
              error={error.instagram}
            />
            <SelectWithLabel
              className='w-full'
              label='Tipo de entrada'
              id='ticketTypeId'
              name='ticketTypeId'
              defaultValue=''
              values={event!.ticketTypes.map((type) => ({
                label: type.name,
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
            <Button type='submit'>Emitir ticket</Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
