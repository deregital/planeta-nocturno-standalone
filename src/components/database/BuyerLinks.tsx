import { Mail } from 'lucide-react';

import { Instagram } from '@/components/icons/Instagram';
import { WhatsApp } from '@/components/icons/WhatsApp';

interface BuyerLinksParams {
  instagram?: string | null;
  phoneNumber?: string | null;
  mail?: string | null;
}

export default function BuyerLinks({
  instagram,
  phoneNumber,
  mail,
}: BuyerLinksParams) {
  return (
    <div className='flex justify-center items-center gap-4 ml-8 [&>div]:w-9 [&>div]:h-9 [&>div]:inline-flex [&>div]:items-center [&>div]:justify-center [&>div]:border [&>div]:rounded-sm [&>div]:transition'>
      {instagram && (
        <div className='bg-[#DA00A4] hover:bg-[#DA00A4]/75'>
          <a
            href={`https://instagram.com/${instagram}`}
            target='_blank'
            rel='noopener noreferrer'
            aria-label='Instagram'
            className='text-white '
          >
            <Instagram />
          </a>
        </div>
      )}
      {phoneNumber && (
        <div className='bg-[#00C500] hover:bg-[#00C500]/75'>
          <a
            href={`https://wa.me/${phoneNumber}`}
            target='_blank'
            rel='noopener noreferrer'
            aria-label='WhatsApp'
            className='text-white'
          >
            <WhatsApp />
          </a>
        </div>
      )}
      {mail && (
        <div className='bg-[#DA0004] hover:bg-[#DA0004]/75'>
          <a
            href={`mailto:${mail}`}
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
  );
}
