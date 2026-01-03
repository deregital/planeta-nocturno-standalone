import { toast } from 'sonner';

import LinksModal from '@/components/admin/organizer/LinksModal';
import GoogleDrive from '@/components/icons/GoogleDrive';
import { MercadoPago } from '@/components/icons/MercadoPago';

interface OrganizerLinksParams {
  mercadopago?: string | null;
  googleDriveUrl?: string | null;
  organizerId: string;
}

export default function OrganizerLinks({
  mercadopago,
  googleDriveUrl,
  organizerId,
}: OrganizerLinksParams) {
  return (
    <div className='flex justify-center items-center gap-4 [&>a]:w-9 [&>a]:h-9 [&>a]:inline-flex [&>a]:items-center [&>a]:cursor-pointer [&>a]:justify-center [&>a]:border [&>a]:border-black [&>a]:rounded-sm [&>a]:transition'>
      {mercadopago && (
        <a
          aria-label='MercadoPago'
          className='text-white bg-[#00BCFF] hover:bg-[#00BCFF]/75'
          onClick={async () => {
            await navigator.clipboard
              .writeText(mercadopago)
              .then(() => toast.success('Mercado Pago copiado al portapapeles'))
              .catch(() =>
                toast.error('Error al copiar Mercado Pago al portapapeles'),
              );
          }}
        >
          <MercadoPago />
        </a>
      )}
      {googleDriveUrl && (
        <a
          href={googleDriveUrl}
          target='_blank'
          rel='noopener noreferrer'
          aria-label='Google Drive'
          className='bg-white hover:bg-gray-200'
        >
          <GoogleDrive />
        </a>
      )}
      <LinksModal
        organizerId={organizerId}
        mercadopago={mercadopago}
        googleDriveUrl={googleDriveUrl}
      />
    </div>
  );
}
