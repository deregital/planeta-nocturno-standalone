import { trpc } from '@/server/trpc/server';
import { subMonths } from 'date-fns';

export default async function Dashboard() {
  const statistics = await trpc.statistics.getStatistics({
    from: subMonths(new Date(), 1),
    to: new Date(),
  });

  return (
    <div>
      <p>Dinero Recaudado: ${statistics.totalRaised}</p>
      <p>Entradas vendidas: {statistics.totalSold}</p>
      <p>
        Tasa de asistencia: %{statistics.scannedPercentage} (
        {statistics.totalScanned} / {statistics.totalTickets})
      </p>
      <pre>{JSON.stringify(statistics ?? 'No hay estadisticas', null, 2)}</pre>
    </div>
  );
}
