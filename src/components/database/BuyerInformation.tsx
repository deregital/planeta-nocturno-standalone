import { format } from 'date-fns';
import { format as formatPhoneNumber } from 'libphonenumber-js';
import { Cake, Contact, IdCard, Mail, Phone, VenusAndMars } from 'lucide-react';

import { FilledCard } from '@/components/common/FilledCard';
import { Instagram } from '@/components/icons/Instagram';
import { genderTranslation } from '@/lib/translations';

interface BuyerInformationParams {
  buyer: {
    buyerCode: string;
    dni: string;
    birthDate: string;
    age: string;
    gender: string;
    phoneNumber: string;
    mail: string;
    instagram: string;
  };
}

export default function BuyerInformation({ buyer }: BuyerInformationParams) {
  return (
    <FilledCard className='flex flex-col gap-4 text-xl font-medium p-4 py-8 lg:w-2/5 [&>div]:flex [&>div]:gap-2 text-accent-dark h-fit'>
      <div>
        <Contact />
        <p>
          <span className='text-gray-600'>ID:</span> {buyer.buyerCode}
        </p>
      </div>
      <div>
        <IdCard />
        <p>
          <span className='text-gray-600'>DNI/Pasaporte:</span> {buyer.dni}
        </p>
      </div>
      <div>
        <Cake />
        <p>
          <span className='text-gray-600'>Fecha de nacimiento:</span>{' '}
          {format(buyer.birthDate, 'dd/MM/yyyy')}{' '}
          <span className='text-sm'>({buyer.age} años)</span>
        </p>
      </div>
      <div>
        <VenusAndMars />
        <p>
          <span className='text-gray-600'>Género:</span>{' '}
          {buyer.gender === 'female' ||
          buyer.gender === 'male' ||
          buyer.gender === 'other'
            ? genderTranslation[buyer.gender]
            : 'No definido'}
        </p>
      </div>
      <div>
        <Phone />
        <p>
          <span className='text-gray-600'>Número de teléfono:</span>{' '}
          {formatPhoneNumber(buyer.phoneNumber, 'INTERNATIONAL')}
        </p>
      </div>
      <div>
        <Mail />
        <p>
          <span className='text-gray-600'>Email:</span> {buyer.mail}
        </p>
      </div>
      <div>
        <Instagram />
        <p>
          <span className='text-gray-600'>Instagram:</span>{' '}
          {buyer.instagram ? `@${buyer.instagram}` : '-'}
        </p>
      </div>
    </FilledCard>
  );
}
