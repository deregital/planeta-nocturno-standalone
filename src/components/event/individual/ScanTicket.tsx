'use client';

import { ScanBarcode } from 'lucide-react';
import { useRouter } from 'next/navigation';

import useIsMobile from '@/hooks/useIsMobile';
import { Button } from '@/components/ui/button';
import { ScanTicketModal } from '@/components/event/individual/ScanTicketModal';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ComponentProps<'button'> {
  className?: string;
}

function ScanTicketButton(props: ButtonProps) {
  const { className, ...rest } = props;
  return (
    <Button className={cn('flex gap-x-5', className)} {...rest}>
      Escanear ticket
      <ScanBarcode className='size-5' />
    </Button>
  );
}

export function ScanTicket({
  eventId,
  eventSlug,
}: {
  eventId: string;
  eventSlug: string;
}) {
  const { isMobile } = useIsMobile();
  const router = useRouter();

  return isMobile ? (
    <ScanTicketButton
      onClick={() => {
        router.push(`/admin/event/${eventSlug}/scan`);
      }}
    />
  ) : (
    <ScanTicketModal eventId={eventId} trigger={<ScanTicketButton />} />
  );
}
