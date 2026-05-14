type TicketGroupForStats = {
  ticketTypePerGroups: {
    amount: number | null;
    ticketType: {
      price: number | null;
    } | null;
  }[];
  emittedTickets: {
    scanned: boolean;
    gender?: string | null;
  }[];
};

export function calculateTicketGroupStats(ticketGroups: TicketGroupForStats[]) {
  const { totalRaised, totalSold } = ticketGroups
    .flatMap((ticketGroup) => ticketGroup.ticketTypePerGroups)
    .reduce(
      (acc, ttpg) => {
        const price = ttpg.ticketType?.price ?? 0;
        const amount = ttpg.amount ?? 0;

        acc.totalRaised += amount * price;
        acc.totalSold += amount;

        return acc;
      },
      { totalRaised: 0, totalSold: 0 },
    );

  const allTickets = ticketGroups.flatMap((tg) => tg.emittedTickets);
  const { totalTickets, totalScanned } = allTickets.reduce(
    (acc, ticket) => {
      acc.totalTickets++;
      if (ticket.scanned) {
        acc.totalScanned++;
      }

      return acc;
    },
    { totalTickets: 0, totalScanned: 0 },
  );

  const genderCounts: Record<string, number> = {};
  for (const ticket of allTickets) {
    if (!ticket.scanned || !ticket.gender) continue;
    genderCounts[ticket.gender] = (genderCounts[ticket.gender] ?? 0) + 1;
  }

  return {
    totalRaised,
    totalSold,
    totalTickets,
    totalScanned,
    scannedPercentage:
      totalTickets > 0 ? (totalScanned / totalTickets) * 100 : 0,
    genderCounts,
  };
}

export function calculateCalendarEventStats(
  ticketGroups: TicketGroupForStats[],
) {
  const stats = calculateTicketGroupStats(ticketGroups);

  return {
    ticketsSold: stats.totalSold,
    ticketsIssued: stats.totalTickets,
    ticketsScanned: stats.totalScanned,
    attendanceRate: stats.scannedPercentage,
    totalRaised: stats.totalRaised,
  };
}
