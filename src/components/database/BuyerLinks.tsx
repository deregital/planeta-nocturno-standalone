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
    <div className='flex justify-center items-center gap-4 ml-8 [&>a]:w-9 [&>a]:h-9 [&>a]:inline-flex [&>a]:items-center [&>a]:cursor-pointer [&>a]:justify-center [&>a]:border [&>a]:border-black [&>a]:rounded-sm [&>a]:transition'>
      {instagram && (
        <a
          href={`https://instagram.com/${instagram}`}
          target='_blank'
          rel='noopener noreferrer'
          aria-label='Instagram'
          className='text-white bg-[#DA00A4] hover:bg-[#DA00A4]/75'
        >
          <Instagram />
        </a>
      )}
      {phoneNumber && (
        <a
          href={`https://wa.me/${phoneNumber}`}
          target='_blank'
          rel='noopener noreferrer'
          aria-label='WhatsApp'
          className='text-white bg-[#00C500] hover:bg-[#00C500]/75'
        >
          <WhatsApp />
        </a>
      )}
      {mail && (
        <a
          href={`mailto:${mail}`}
          target='_blank'
          rel='noopener noreferrer'
          aria-label='Email'
          className='text-white bg-[#DA0004] hover:bg-[#DA0004]/75'
        >
          <Mail />
        </a>
      )}
    </div>
  );
}
