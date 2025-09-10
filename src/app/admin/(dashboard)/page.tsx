'use client';
import { addDays, subMonths } from 'date-fns';
import { parseAsIsoDate, useQueryState } from 'nuqs';
import { useMemo } from 'react';

import AttendanceChart from '@/components/admin/AttendanceChart';
import ComparativeTable from '@/components/admin/ComparativeTable';
import { StatisticsSkeleton } from '@/components/admin/DatabaseSkeleton';
import { DateRangePicker } from '@/components/admin/DataRangePicker';
import GenderPie from '@/components/admin/GenderPie';
import { BaseCard } from '@/components/common/BaseCard';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/server/trpc/client';

export default function Dashboard() {
  const today = useMemo(() => new Date(), []);

  const [from, setFrom] = useQueryState<Date>(
    'from',
    parseAsIsoDate.withDefault(subMonths(today, 1)),
  );
  const [to, setTo] = useQueryState<Date>(
    'to',
    parseAsIsoDate.withDefault(today),
  );

  const {
    data: statistics,
    isLoading,
    refetch,
  } = trpc.statistics.getStatistics.useQuery({
    from,
    to,
  });

  const utils = trpc.useUtils();

  return (
    <div className='flex gap-8 flex-col my-16 px-4'>
      <BaseCard className='border-2'>
        <BaseCard className='flex flex-col sm:grid sm:grid-rows-7 sm:grid-cols-2 md:1/6 lg:h-96 lg:grid-cols-4 p-3 border-0'>
          {/* TImestamp */}

          {isLoading || !statistics ? (
            <StatisticsSkeleton />
          ) : (
            <>
              <BaseCard className='sm:col-span-2 sm:row-span-1 lg:row-span-2 lg:row-start-1 col-span-2 flex justify-center items-center border-0'>
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
                    refetch();
                    utils.statistics.getLocationsStats.invalidate();
                    utils.statistics.getEventsStats.invalidate();
                  }}
                />
              </BaseCard>
              <BaseCard className='sm:col-start-1 sm:row-span-3 sm:col-span-2 sm:row-start-2 lg:row-span-5 p-12 gap-8 justify-center items-center'>
                <div className='flex justify-center lg:justify-baseline items-center w-full gap-6'>
                  <p className='text-3xl'>Tasa de asistencia:</p>
                  <p className='text-5xl font-medium text-accent'>
                    {Intl.NumberFormat('es-AR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(statistics.scannedPercentage)}
                    %
                  </p>
                </div>
                <Progress
                  value={statistics.scannedPercentage}
                  className='h-12 [&>div]:bg-accent [&>div]:rounded-full md:mt-8'
                />
              </BaseCard>

              {/* Total Raised */}
              <BaseCard className='sm:row-start-5 sm:row-span-3 lg:grid-start-3 lg:row-span-7 lg:row-start-1 flex flex-col justify-start items-center px-4 py-8'>
                <p className='text-3xl font-light text-center'>
                  Dinero recaudado
                </p>
                <p className='text-6xl lg:text-5xl xl:text-6xl text-accent font-medium lg:py-16'>
                  {Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: 'ARS',
                    maximumFractionDigits: 0,
                  }).format(statistics.totalRaised)}
                </p>
              </BaseCard>

              {/* Total Sold  */}
              <BaseCard className='sm:row-start-5 sm:row-span-3 lg:grid-start-3 lg:row-span-7 lg:row-start-1 flex flex-col justify-start items-center px-4 py-8'>
                <p className='text-3xl font-light text-center'>
                  Entradas vendidas
                </p>
                <p className='text-6xl lg:text-5xl xl:text-6xl text-accent font-medium lg:py-16'>
                  {Intl.NumberFormat('es-AR').format(statistics.totalTickets)}
                </p>
              </BaseCard>
            </>
          )}
        </BaseCard>

        <div className='flex flex-col lg:flex-row w-full p-1 px-3 gap-4'>
          {statistics ? (
            <>
              <BaseCard className='flex w-full lg:w-1/2 flex-col lg:mb-3'>
                <p className='text-xl sm:text-2xl lg:text-3xl pt-6 font-light text-center mb-2'>
                  Asistencia por género
                </p>
                <GenderPie data={statistics.genderCounts} />
              </BaseCard>
              <BaseCard className='flex w-full lg:w-1/2 flex-col mb-3'>
                <p className='text-xl sm:text-2xl lg:text-3xl pt-6 font-light text-center mb-2'>
                  Asistencia por hora
                </p>
                <AttendanceChart />
              </BaseCard>
            </>
          ) : (
            <div className='flex flex-col lg:flex-row w-full gap-4'>
              <Skeleton className='w-full lg:w-1/2 h-64 sm:h-80 lg:h-96 py-6 p-3' />
              <Skeleton className='w-full lg:w-1/2 h-64 sm:h-80 lg:h-96 py-6 p-3' />
            </div>
          )}
        </div>
      </BaseCard>
      {/* Comparative table */}
      <BaseCard className='flex flex-col gap-4 border-2 p-3 py-6 max-w-[calc(100vw-3rem)] md:max-w-[calc(100vw-14rem)]'>
        <ComparativeTable />
      </BaseCard>
    </div>
  );
}
