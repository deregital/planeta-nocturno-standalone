'use client';

import { subMonths } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';

import { SelectableComboBox } from '@/components/admin/SelectableComboBox';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { getColors } from '@/lib/get-colors';
import { trpc } from '@/server/trpc/client';

export default function AttendanceChart() {
  const today = useMemo(() => new Date(), []);
  const searchParams = useSearchParams();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const from = searchParams.get('from')
    ? new Date(searchParams.get('from') as string)
    : subMonths(today, 1);
  const to = searchParams.get('to')
    ? new Date(searchParams.get('to') as string)
    : today;

  const { data: allEvents, isRefetching: isRefetchingEvents } =
    trpc.statistics.getEventsStats.useQuery({
      from,
      to,
    });

  const { data: hourlyAttendanceData, isLoading: isLoadingHourlyData } =
    trpc.statistics.getEventHourlyAttendance.useQuery(
      {
        eventId: selectedEventId!,
        from,
        to,
      },
      {
        enabled: !!selectedEventId,
      },
    );

  const eventsList = useMemo(() => {
    return allEvents?.map((e) => ({
      id: e.id,
      name: e.name,
      type: 'EVENT' as const,
    }));
  }, [allEvents]);

  const selectedEvent = useMemo(() => {
    return allEvents?.find((e) => e.id === selectedEventId);
  }, [allEvents, selectedEventId]);

  const eventTimeRange = useMemo(() => {
    if (!hourlyAttendanceData?.eventStart || !hourlyAttendanceData?.eventEnd) {
      return null;
    }

    const start = new Date(hourlyAttendanceData.eventStart);
    const end = new Date(hourlyAttendanceData.eventEnd);

    return {
      start: start.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      end: end.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }, [hourlyAttendanceData]);

  const config = {
    attendance: {
      label: 'Escaneados',
    },
  } satisfies ChartConfig;

  return (
    <div className='px-4 relative min-h-48'>
      {allEvents && (
        <SelectableComboBox
          title='Seleccionar evento'
          listOf='evento'
          list={eventsList ?? []}
          onSelectAction={(item) => setSelectedEventId(item.id)}
        />
      )}

      {selectedEventId && selectedEvent && (
        <div className='space-y-4'>
          <div className='text-center'>
            <h3 className='text-lg font-semibold'>{selectedEvent.name}</h3>
            {eventTimeRange && (
              <p className='text-sm text-gray-600'>
                De {eventTimeRange.start}hs a {eventTimeRange.end}hs
              </p>
            )}
          </div>
          <div className='h-48 sm:h-56 md:h-64 w-full flex justify-center overflow-hidden'>
            {isLoadingHourlyData ? (
              <div className='flex items-center justify-center h-full'>
                <div className='text-gray-500'>Cargando datos...</div>
              </div>
            ) : hourlyAttendanceData?.chartData &&
              hourlyAttendanceData.chartData.length > 0 ? (
              <div className='w-full h-full'>
                <ChartContainer config={config} className='h-full w-full'>
                  <BarChart data={hourlyAttendanceData.chartData}>
                    <XAxis
                      dataKey='hour'
                      tick={{
                        fontSize: 10,
                        className: 'text-xs sm:text-sm',
                      }}
                      angle={-45}
                      textAnchor='end'
                      height={60}
                      interval='preserveStartEnd'
                    />
                    <YAxis
                      label={{
                        value: 'Asistencia',
                        angle: -90,
                        style: { fontSize: '12px' },
                      }}
                      tick={{
                        fontSize: 10,
                        className: 'text-xs sm:text-sm',
                      }}
                      tickFormatter={(value) =>
                        Number.isInteger(value) ? value : ''
                      }
                      width={40}
                    />
                    <Bar
                      dataKey='attendance'
                      fill={getColors().accentColor}
                      radius={[6, 6, 0, 0]}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent className='bg-white' />}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            ) : (
              <div className='flex items-center justify-center h-full'>
                <div className='text-gray-500'>
                  No hay datos de asistencia para este evento
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
