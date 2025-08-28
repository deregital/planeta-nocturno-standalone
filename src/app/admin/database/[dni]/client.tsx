'use client';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Cake, IdCard, Phone, VenusAndMars } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { BaseCard } from '@/components/common/BaseCard';
import { FilledCard } from '@/components/common/FilledCard';
import { Instagram } from '@/components/icons/Instagram';
import { Button } from '@/components/ui/button';
import { genderTranslation } from '@/lib/translations';
import { type RouterOutputs } from '@/server/routers/app';

export default function Client({
  data,
}: {
  data: RouterOutputs['emittedTickets']['getUniqueBuyer'];
}) {
  const { buyer, emittedTickets } = data!;
  const router = useRouter();

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
        <h1 className='text-4xl font-bold text-accent-dark'>
          {buyer.fullName}
        </h1>
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
            <p>Instagram: {buyer.instagram ? `@${buyer.instagram}` : '-'}</p>
          </div>
        </FilledCard>

        <FilledCard className='flex w-full p-4 flex-col text-accent-dark'>
          <p className='text-3xl font-bold'>Últimos eventos asistidos:</p>
          <div className='space-y-4 max-h-96 overflow-y-auto my-4'>
            {emittedTickets.map((ticket) => (
              <BaseCard
                key={ticket.id + '_' + ticket.ticketGroup.id}
                className='flex flow-row justify-center bg-white p-2 text-lg font-medium'
              >
                <p>
                  {ticket.ticketGroup.event.name} -{' '}
                  {format(
                    parseISO(ticket.ticketGroup.event.startingDate),
                    'dd/MM/yyyy',
                  )}{' '}
                  - {ticket.ticketGroup.event.location.name}
                </p>
              </BaseCard>
            ))}
          </div>
        </FilledCard>
      </div>
    </div>
  );
}
