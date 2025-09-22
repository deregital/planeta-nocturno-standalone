'use client';
import { format } from 'date-fns';
import { Cake, IdCard, Mail, Phone, VenusAndMars } from 'lucide-react';
import { format as formatPhoneNumber } from 'libphonenumber-js';

import AttendedEventsTable from '@/components/admin/BuyerTable';
import { FilledCard } from '@/components/common/FilledCard';
import GoBack from '@/components/common/GoBack';
import { Instagram } from '@/components/icons/Instagram';
import { WhatsApp } from '@/components/icons/WhatsApp';
import { genderTranslation } from '@/lib/translations';
import { type RouterOutputs } from '@/server/routers/app';

export default function Client({
  data,
}: {
  data: RouterOutputs['emittedTickets']['getUniqueBuyer'];
}) {
  const { buyer, events } = data!;

  const normalizedInstagram = buyer.instagram
    ? buyer.instagram.startsWith('@')
      ? buyer.instagram.slice(1)
      : buyer.instagram
    : '';

  return (
    <div className='flex flex-col gap-4 p-4'>
      <GoBack route='/admin/database' className='size-fit my-2' />
      <div className='flex'>
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
                href={`https://wa.me/${buyer.phoneNumber}`}
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
        <FilledCard className='flex flex-col gap-4 text-xl font-medium p-4 py-8 lg:w-2/5 [&>div]:flex [&>div]:gap-2 text-accent-dark h-fit'>
          <div>
            <IdCard />
            <p>DNI/Pasaporte: {buyer.dni}</p>
          </div>
          <div>
            <Cake />
            <p>
              Fecha de nacimiento: {format(buyer.birthDate, 'dd/MM/yyyy')}{' '}
              <span className='text-sm'>({buyer.age} años)</span>
            </p>
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
            <p>
              Número de teléfono:{' '}
              {formatPhoneNumber(buyer.phoneNumber, 'INTERNATIONAL')}
            </p>
          </div>
          <div>
            <Instagram />
            <p>
              Instagram: {buyer.instagram ? `@${normalizedInstagram}` : '-'}
            </p>
          </div>
        </FilledCard>

        <FilledCard className='flex flex-1 max-w-full p-4 flex-col text-accent-dark'>
          <p className='text-3xl font-bold'>Últimos eventos asistidos:</p>
          <AttendedEventsTable events={events} />
        </FilledCard>
      </div>
    </div>
  );
}
