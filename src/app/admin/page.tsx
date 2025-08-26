'use client';
import { addDays, subMonths } from 'date-fns';
import { Loader } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { DateRangePicker } from '@/components/admin/DataRangePicker';
import { BaseCard } from '@/components/common/BaseCard';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/server/trpc/client';

export default function Dashboard() {
  const today = useMemo(() => new Date(), []);

  const [from, setFrom] = useState(subMonths(today, 1));
  const [to, setTo] = useState(today);
  const [currency, setCurrency] = useState('peso');

  const {
    data: statistics,
    isLoading,
    refetch,
  } = trpc.statistics.getStatistics.useQuery({
    from,
    to,
  });

  useEffect(() => {
    refetch();
  }, [from, to, statistics]);

  if (isLoading) {
    return <Loader />;
  }
  if (!statistics) {
    return <p>No hay datos de estadisticas.</p>;
  }

  return (
    <div className='my-16 px-4'>
      <BaseCard className='grid grid-cols-4 grid-rows-5 h-96 p-3 border-2'>
        {/* TImestamp */}
        <BaseCard className='col-span-2 row-span-1 flex justify-center items-center border-0'>
          <DateRangePicker
            align='start'
            value={{
              from,
              to,
            }}
            showCompare={false}
            initialDateFrom={subMonths(today, 1)}
            initialDateTo={today}
            locale='es-AR'
            onUpdate={({ range }) => {
              setFrom(range.from);
              setTo(
                range.to
                  ? new Date(addDays(range.to, 1).getTime() - 1000)
                  : new Date(addDays(new Date(), 1).getTime() - 1000),
              );
            }}
          />
        </BaseCard>
        {/* Assitance % */}
        <BaseCard className='col-start-1 col-span-2 row-span-4 row-start-2 p-12 gap-8 flex flex-col justify-center items-center'>
          <div className='flex justify-baseline items-center w-full gap-6'>
            <p className='text-3xl '>Tasa de asistencia:</p>
            <p className='text-5xl font-medium text-pn-accent'>
              {Intl.NumberFormat('es-AR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(statistics.scannedPercentage)}
              %
            </p>
          </div>
          <Progress
            value={statistics.scannedPercentage}
            className='h-12 [&>div]:bg-pn-accent [&>div]:rounded-full'
          />
        </BaseCard>

        {/* Total Raised */}
        <BaseCard className='grid-start-3 row-span-5 flex flex-col justify-start items-center px-4 py-8'>
          <p className='text-3xl font-light'>Dinero Recaudado</p>
          <p className='text-6xl text-pn-accent font-medium py-16'>
            {Intl.NumberFormat('es-AR', {
              style: 'currency',
              currency: 'ARS',
              maximumFractionDigits: 0,
            }).format(statistics.totalRaised)}
          </p>
          <Select
            value={currency}
            onValueChange={(value) => {
              setCurrency(value);
            }}
          >
            <SelectTrigger className='w-[180px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Moneda</SelectLabel>
                <SelectItem value='peso'>Pesos argentinos</SelectItem>
                <SelectItem value='dollar'>Dolar estadounidense</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </BaseCard>

        {/* Total Sold  */}
        <BaseCard className='grid-start-3 row-span-5 flex flex-col justify-start items-center px-4 py-8'>
          <p className='text-3xl font-light'>Entradas vendidas</p>
          <p className='text-6xl text-pn-accent font-medium py-16'>
            {Intl.NumberFormat('es-AR').format(statistics.totalTickets)}
          </p>
        </BaseCard>
      </BaseCard>
      {/* <pre>{JSON.stringify(statistics ?? 'No hay estadisticas', null, 2)}</pre> */}
    </div>
  );
}
