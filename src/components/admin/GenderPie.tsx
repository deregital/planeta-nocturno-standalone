'use client';

import { Cell, Legend, Pie, PieChart } from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { getColors } from '@/lib/get-colors';
import { genderTranslation } from '@/lib/translations';

const colors = getColors();

const pieColors = [colors.accentColor, colors.accentLight, colors.buttonColor];

export default function GenderPie({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([key, value]) => ({
    name: genderTranslation[key as keyof typeof genderTranslation] || key,
    value,
  }));

  const config = {
    gender: {
      label: 'Género',
    },
  } satisfies ChartConfig;

  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className='flex flex-col gap-2 sm:gap-4 justify-center items-center w-full h-full'>
      <ChartContainer config={config} className='h-48 sm:h-64 md:h-80 w-full'>
        <PieChart>
          <Pie
            data={chartData}
            cx='50%'
            cy='50%'
            outerRadius={80}
            innerRadius={30}
            dataKey='value'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label={(entry: any) => {
              const percentage =
                total > 0 ? ((entry.value || 0) / total) * 100 : 0;
              return `${entry.name}: ${percentage.toFixed(1)}%`;
            }}
            className='text-xs sm:text-sm md:text-base'
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={pieColors[index % pieColors.length]}
              />
            ))}
          </Pie>
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
            wrapperStyle={{
              fontSize: '12px',
              paddingTop: '10px',
            }}
          />
        </PieChart>
      </ChartContainer>
    </div>
  );
}
