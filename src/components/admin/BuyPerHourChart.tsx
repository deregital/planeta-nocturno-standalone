'use client';

import { subMonths } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Bar, BarChart, Legend, XAxis, YAxis } from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { getColors } from '@/lib/get-colors';
import { trpc } from '@/server/trpc/client';

export default function BuyPerHourChart() {
  const today = useMemo(() => new Date(), []);
  const searchParams = useSearchParams();

  const from = searchParams.get('from')
    ? new Date(searchParams.get('from') as string)
    : subMonths(today, 1);
  const to = searchParams.get('to')
    ? new Date(searchParams.get('to') as string)
    : today;
  const eventId = searchParams.get('eventId') ?? undefined;

  const { data } = trpc.statistics.getEmittedTicketsPerHour.useQuery({
    from,
    to,
    eventId,
  });

  const eventColors = useMemo(() => {
    if (!data?.events) return {};
    const colors = getColors();
    const colorPalette = [
      colors.accentColor,
      colors.brandColor,
      colors.accentLight,
      colors.accentUltraLight,
    ];

    const eventColorMap: Record<string, string> = {};
    data.events.forEach((event, index) => {
      eventColorMap[event.name] = colorPalette[index];
    });
    return eventColorMap;
  }, [data?.events]);

  const config = useMemo(() => {
    if (!data?.events) return {};

    const chartConfig: ChartConfig = {};
    data.events.forEach((event) => {
      chartConfig[event.name] = {
        label: event.name,
      };
    });
    return chartConfig;
  }, [data?.events]);

  return (
    <div className='flex justify-center space-y-4 overflow-hidden h-full'>
      {!data ? (
        <p className='text-center'>No hay datos de tickets emitidos</p>
      ) : (
        <ChartContainer config={config} className='h-full w-full'>
          <BarChart data={data?.chartData ?? []}>
            <XAxis
              dataKey='hour'
              angle={-45}
              textAnchor='end'
              height={50}
              interval='preserveStartEnd'
            />
            <YAxis
              label={{
                value: 'Tickets emitidos',
                angle: -90,
              }}
              tickFormatter={(value) => (Number.isInteger(value) ? value : '')}
              width={35}
            />
            {data?.events?.map((event) => (
              <Bar
                key={event.id}
                dataKey={event.name}
                stackId='emittedTickets'
                fill={eventColors[event.name]}
                radius={[0, 0, 0, 0]}
              />
            ))}
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent className='bg-white' />}
            />
            <Legend
              iconType='circle'
              formatter={(value) => (
                <span className='font-medium text-xs sm:text-sm md:text-base align-middle'>
                  {value}
                </span>
              )}
              verticalAlign='bottom'
              layout='horizontal'
              wrapperStyle={{
                fontSize: '12px',
                bottom: 0,
                position: 'absolute',
              }}
            />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}
