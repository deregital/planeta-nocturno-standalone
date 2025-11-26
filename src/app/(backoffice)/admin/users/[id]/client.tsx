'use client';

import { addDays, format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseAsIsoDate, useQueryState } from 'nuqs';
import { type StrictColumnDef } from '@tanstack/react-table';
import { Loader, Mail } from 'lucide-react';

import { DateRangePicker } from '@/components/admin/DataRangePicker';
import { DataTable } from '@/components/common/DataTable';
import { FilledCard } from '@/components/common/FilledCard';
import GoBack from '@/components/common/GoBack';
import { Instagram } from '@/components/icons/Instagram';
import { WhatsApp } from '@/components/icons/WhatsApp';
import { Skeleton } from '@/components/ui/skeleton';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

type OrganizerInfo = RouterOutputs['organizer']['getAdminInfoById'];
type OrganizerStats = RouterOutputs['organizer']['getAdminStatsById'];

type RecentEvent = OrganizerInfo['recentEvents'][number];

const eventColumns: StrictColumnDef<RecentEvent>[] = [
  {
    accessorKey: 'name',
    header: 'Evento',
    cell: ({ row }) => <div className='font-medium'>{row.original.name}</div>,
    meta: {
      exportValue: (row) => row.original.name,
      exportHeader: 'Evento',
    },
  },
  {
    accessorKey: 'startingDate',
    header: 'Fecha',
    cell: ({ row }) => (
      <div>
        {format(new Date(row.original.startingDate), 'dd/MM/yyyy HH:mm', {
          locale: es,
        })}
      </div>
    ),
    meta: {
      exportValue: (row) =>
        format(new Date(row.original.startingDate), 'dd/MM/yyyy HH:mm', {
          locale: es,
        }),
      exportHeader: 'Fecha',
    },
  },
  {
    accessorKey: 'location',
    header: 'Ubicación',
    cell: ({ row }) => (
      <div className='text-sm text-muted-foreground'>
        {row.original.location?.name || '-'}
      </div>
    ),
    meta: {
      exportValue: (row) => row.original.location?.name || '-',
      exportHeader: 'Ubicación',
    },
  },
];

export default function Client({ organizerId }: { organizerId: string }) {
  const today = new Date();

  const [from, setFrom] = useQueryState<Date>(
    'from',
    parseAsIsoDate.withDefault(subMonths(today, 1)),
  );
  const [to, setTo] = useQueryState<Date>(
    'to',
    parseAsIsoDate.withDefault(today),
  );

  const {
    data: info,
    isLoading: isLoadingInfo,
    isError: isErrorInfo,
  } = trpc.organizer.getAdminInfoById.useQuery(organizerId);

  const {
    data: stats,
    isLoading: isLoadingStats,
    isError: isErrorStats,
  } = trpc.organizer.getAdminStatsById.useQuery({
    organizerId,
    from,
    to,
  });

  if (isLoadingInfo) {
    return <Loader className='spin-in' />;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const normalizedInstagram = info?.organizer.instagram
    ? info?.organizer.instagram.startsWith('@')
      ? info?.organizer.instagram.slice(1)
      : info?.organizer.instagram
    : '';

  return (
    <div className='flex flex-col gap-4 p-4'>
      <GoBack route='/admin/users' className='size-fit my-2' />
      <div className='flex'>
        <h1 className='text-4xl font-bold text-accent'>
          {info?.organizer.name}
        </h1>
        <div className='flex justify-center items-center gap-4 ml-8 [&>div]:w-9 [&>div]:h-9 [&>div]:inline-flex [&>div]:items-center [&>div]:justify-center [&>div]:border [&>div]:rounded-sm [&>div]:transition'>
          {info?.organizer.instagram && (
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
          {info?.organizer.phoneNumber && (
            <div className='bg-[#00C500] hover:bg-[#00C500]/75'>
              <a
                href={`https://wa.me/${info.organizer.phoneNumber}`}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='WhatsApp'
                className='text-white'
              >
                <WhatsApp />
              </a>
            </div>
          )}
          {info?.organizer.email && (
            <div className='bg-[#DA0004] hover:bg-[#DA0004]/75'>
              <a
                href={`mailto:${info?.organizer.email}`}
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
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <FilledCard className='lg:col-span-2 p-4 flex-col text-accent-dark'>
          <p className='text-3xl font-bold'>Últimos eventos asistidos:</p>
          {isLoadingInfo ? (
            <div className='text-center py-8'>
              <Loader className='spin-in' />
            </div>
          ) : (
            <DataTable
              columns={eventColumns}
              data={info?.recentEvents || []}
              noResultsPlaceholder='No hay eventos registrados'
            />
          )}
        </FilledCard>

        <FilledCard className='lg:col-span-1 p-4 flex-col text-accent-dark'>
          <div className='flex flex-col gap-4'>
            <div className='flex items-center justify-between gap-4'>
              <p className='text-3xl font-bold'>Estadísticas</p>
            </div>
            <DateRangePicker
              align='start'
              value={{ from, to }}
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
          </div>
          {isLoadingStats ? (
            <div className='space-y-3 py-4'>
              <Skeleton className='h-22 w-full rounded-md bg-white' />
              <Skeleton className='h-22 w-full rounded-md bg-white' />
              <Skeleton className='h-22 w-full rounded-md bg-white' />
            </div>
          ) : stats && !isErrorStats ? (
            <>
              <FilledCard className='p-4 my-3 bg-white'>
                <div className='space-y-1'>
                  <p className='text-muted-foreground'>Tickets Vendidos</p>
                  <p className='text-2xl font-bold'>
                    {stats.statistics.ticketsSold || 0}
                  </p>
                </div>
              </FilledCard>

              <FilledCard className='p-4 my-3 bg-white'>
                <div className='space-y-1'>
                  <p className=' text-muted-foreground'>
                    Porcentaje de Asistencia
                  </p>
                  <p className='text-2xl font-bold'>
                    {stats.statistics.attendancePercentage
                      ? stats.statistics.attendancePercentage.toFixed(1)
                      : '0.0'}
                    %
                  </p>
                </div>
              </FilledCard>

              <FilledCard className='p-4 my-3 bg-white'>
                <div className='space-y-1'>
                  <p className='text-muted-foreground'>Dinero Generado</p>
                  <p className='text-2xl font-bold'>
                    {stats.statistics.moneyGenerated
                      ? formatCurrency(stats.statistics.moneyGenerated)
                      : '$0'}
                  </p>
                </div>
              </FilledCard>
            </>
          ) : (
            <div className='text-center py-8'>
              <p className='text-muted-foreground'>
                No hay estadísticas disponibles
              </p>
            </div>
          )}
        </FilledCard>
      </div>
    </div>
  );
}
