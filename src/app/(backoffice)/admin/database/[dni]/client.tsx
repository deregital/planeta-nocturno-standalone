'use client';

import AttendedEventsTable from '@/components/admin/BuyerTable';
import EmissionHistoryTable from '@/components/admin/EmissionHistoryTable';
import { FilledCard } from '@/components/common/FilledCard';
import GoBack from '@/components/common/GoBack';
import BuyerInformation from '@/components/database/BuyerInformation';
import BuyerLinks from '@/components/database/BuyerLinks';
import { type RouterOutputs } from '@/server/routers/app';

export default function Client({
  data,
  emissionHistory,
}: {
  data: RouterOutputs['emittedTickets']['getUniqueBuyer'];
  emissionHistory: RouterOutputs['emittedTickets']['getEmissionHistoryByDni'];
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
      <div className='flex flex-col gap-3 md:flex-row md:gap-0'>
        <h1 className='text-4xl font-bold text-accent'>
          {buyer.fullName}{' '}
          <span className='text-3xl text-gray-500'>ID: {buyer.buyerCode}</span>
        </h1>
        <BuyerLinks
          instagram={normalizedInstagram}
          phoneNumber={buyer.phoneNumber}
          mail={buyer.mail}
          className='justify-start ml-0 md:ml-8 md:justify-center'
        />
      </div>

      <div className='flex gap-8 flex-col lg:flex-row'>
        <BuyerInformation
          buyer={{ ...buyer, instagram: normalizedInstagram }}
        />

        <FilledCard className='flex flex-1 max-w-full p-4 flex-col text-accent-dark'>
          <p className='text-3xl font-bold'>Últimos eventos asistidos:</p>
          <AttendedEventsTable events={events} buyerName={buyer.fullName} />
        </FilledCard>
      </div>

      <FilledCard className='flex max-w-full p-4 flex-col text-accent-dark'>
        <p className='text-3xl font-bold'>Historial de emisiones:</p>
        <EmissionHistoryTable
          tickets={emissionHistory}
          buyerName={buyer.fullName}
        />
      </FilledCard>
    </div>
  );
}
