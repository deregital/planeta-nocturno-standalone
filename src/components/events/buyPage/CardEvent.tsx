import { Calendar, Clock } from 'lucide-react';
import Image from 'next/image';

interface CardEventProps {
  title: string;
  dayOfWeek: string;
  date: string;
  month: string;
  year: string;
  time: string;
  imageUrl: string;
  disabled?: boolean;
}

function CardEvent({
  title,
  dayOfWeek,
  date,
  month,
  year,
  time,
  imageUrl = '/Foto.png',
  disabled,
}: CardEventProps) {
  return (
    <div
      className={`bg-white rounded-3xl overflow-hidden drop-shadow-md flex h-full w-full flex-col ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:shadow-xl hover:cursor-pointer'} transition-shadow duration-300`}
    >
      <div
        className={`relative h-28 w-full shrink-0 sm:h-44 ${disabled ? 'bg-gray-300' : 'bg-accent/10'}`}
      >
        <Image src={imageUrl} alt={title} fill className='object-cover' />
      </div>
      <div className='flex min-h-0 flex-1 flex-col px-2 py-2 font-sans sm:px-4 sm:py-8'>
        <h3 className='text-sm font-light text-accent-dark sm:text-lg mb-2 sm:mb-5'>
          {title}
        </h3>
        <div className='mt-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-2 text-accent'>
            <div className='flex items-center gap-1'>
              <span className='hidden sm:inline text-xs text-gray-600'>
                {dayOfWeek}
              </span>
              <span className='text-3xl sm:text-2xl font-bold'>{date}</span>
              <div className='flex flex-col'>
                <span className='text-xs'>{month}</span>
                <span className='text-xs'>{year}</span>
              </div>
            </div>
            <Calendar className='size-4 shrink-0' aria-hidden />
          </div>
          <div className='flex items-center gap-2 text-accent'>
            <div className='flex items-center gap-1'>
              <span className='text-3xl sm:text-2xl font-bold'>
                {time.split(':')[0]}{' '}
              </span>
              <div className='flex flex-col'>
                <span className='text-xs'>
                  {time.includes(':') ? time.split(':')[1] : '00'}
                </span>
                <span className='text-xs'>hs</span>
              </div>
            </div>
            <Clock className='size-4 shrink-0' aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CardEvent;
