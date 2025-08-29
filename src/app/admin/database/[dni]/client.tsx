'use client';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  Cake,
  IdCard,
  Mail,
  Phone,
  VenusAndMars,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { BaseCard } from '@/components/common/BaseCard';
import { FilledCard } from '@/components/common/FilledCard';
import { Instagram } from '@/components/icons/Instagram';
import { WhatsApp } from '@/components/icons/WhatsApp';
import { Button } from '@/components/ui/button';
import { genderTranslation } from '@/lib/translations';
import { type RouterOutputs } from '@/server/routers/app';

export default function Client({
  data,
}: {
  data: RouterOutputs['emittedTickets']['getUniqueBuyer'];
}) {
  const { buyer, events } = data!;
  const router = useRouter();

  const normalizedInstagram = buyer.instagram
    ? buyer.instagram.startsWith('@')
      ? buyer.instagram.slice(1)
      : buyer.instagram
    : '';

  return (
    <div className='flex flex-col gap-4 p-4'>
      <Button
        variant={'ghost'}
        className='size-fit py-2'
        onClick={() => router.back()}
      >
        <ArrowLeft className='size-12' />
      </Button>

      <div className='flex '>
        <h1 className='text-4xl font-bold text-accent'>{buyer.fullName}</h1>
        <div className='flex justify-center items-center gap-4 ml-8 [&>div]:w-9 [&>div]:h-9 [&>div]:inline-flex [&>div]:items-center [&>div]:justify-center [&>div]:border [&>div]:rounded-sm [&>div]:transition'>
          {buyer.instagram && (
            <div className='bg-[#DA00A4] hover:bg-[#DA00A4]/75'>
              <a
                href={`https://instagram.com/${normalizedInstagram}`}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Instagram'
                className='text-white '
              >
                <Instagram />
              </a>
            </div>
          )}
          {buyer.phoneNumber && (
            <div className='bg-[#00C500] hover:bg-[#00C500]/75'>
              <a
                href={`https://wa.me/${buyer.phoneNumber.replace(/\D/g, '')}`}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='WhatsApp'
                className='text-white'
              >
                <WhatsApp />
              </a>
            </div>
          )}
          {buyer.mail && (
            <div className='bg-[#DA0004] hover:bg-[#DA0004]/75'>
              <a
                href={`mailto:${buyer.mail}`}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Email'
                className='text-white'
              >
                <Mail />
              </a>
            </div>
          )}
        </div>
      </div>

      <div className='flex gap-8 flex-col lg:flex-row'>
        <FilledCard className='flex flex-col gap-4 text-xl font-medium p-4 py-8 lg:w-2/5 [&>div]:flex [&>div]:gap-2 text-accent-dark'>
          <div>
            <IdCard />
            <p>DNI: {buyer.dni}</p>
          </div>
          <div>
            <Cake />
            <p>Edad: {buyer.age} años</p>
          </div>
          <div>
            <VenusAndMars />
            <p>
              Género:{' '}
              {buyer.gender === 'female' ||
              buyer.gender === 'male' ||
              buyer.gender === 'other'
                ? genderTranslation[buyer.gender]
                : 'No definido'}
            </p>
          </div>
          <div>
            <Phone />
            <p>Número de teléfono: {buyer.phoneNumber}</p>
          </div>
          <div>
            <Instagram />
            <p>
              Instagram: {buyer.instagram ? `@${normalizedInstagram}` : '-'}
            </p>
          </div>
        </FilledCard>

        <FilledCard className='flex w-full p-4 flex-col text-accent-dark'>
          <p className='text-3xl font-bold'>Últimos eventos asistidos:</p>
          <div className='space-y-4 max-h-96 overflow-y-auto my-4'>
            {events.map((event) => (
              <BaseCard
                key={event.id + '_' + event.ticketGroupId}
                className='flex flow-row justify-center bg-white p-2 text-lg font-medium'
              >
                <p>
                  {event.eventName} -{' '}
                  {event.eventStartingDate
                    ? format(parseISO(event.eventStartingDate), 'dd/MM/yyyy')
                    : 'Fecha no definida'}{' '}
                  - {event.locationName}
                </p>
              </BaseCard>
            ))}
          </div>
        </FilledCard>
      </div>
    </div>
  );
}
