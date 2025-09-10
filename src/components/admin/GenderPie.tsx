'use client';

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { getColors } from '@/lib/get-colors';
import { genderTranslation } from '@/lib/translations';

const colors = getColors();

const pieColors = [colors.accentColor, colors.accentLight, colors.buttonColor];

export default function GenderPie({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([key, value]) => ({
    name: genderTranslation[key as keyof typeof genderTranslation] || key,
    value,
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className='flex flex-col gap-4 justify-center items-center'>
      <ResponsiveContainer width='60%' height={400}>
        <PieChart>
          <Pie
            data={chartData}
            cx='50%'
            cy='50%'
            outerRadius={120}
            innerRadius={40}
            dataKey='value'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label={(entry: any) => {
              const percentage =
                total > 0 ? ((entry.value || 0) / total) * 100 : 0;
              return `${entry.name}: ${percentage.toFixed(1)}%`;
            }}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={pieColors[index % pieColors.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [
              Intl.NumberFormat('es-AR').format(value),
              'Cantidad',
            ]}
            labelFormatter={(label) => `Género: ${label}`}
          />
          <Legend
            iconType='circle'
            formatter={(value) => (
              <span className='font-medium text-lg align-middle'>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
