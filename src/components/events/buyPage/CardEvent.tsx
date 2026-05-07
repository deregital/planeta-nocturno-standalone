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
      className={`flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-3xl bg-white drop-shadow-md ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:cursor-pointer hover:shadow-xl'} transition-shadow duration-300`}
    >
      <div
        className={`relative h-32 w-full shrink-0 sm:h-48 ${disabled ? 'bg-gray-300' : 'bg-accent/10'}`}
      >
        <Image src={imageUrl} alt={title} fill className='object-cover' />
      </div>
      <div className='flex min-h-0 flex-1 flex-col justify-between gap-3 px-3 py-4 sm:gap-4 sm:px-4 sm:py-5'>
        <h3 className='line-clamp-3 font-light leading-snug text-accent-dark'>
          {title}
        </h3>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-2 text-accent'>
            <div className='flex items-center gap-1'>
              <span className='hidden sm:inline text-xs text-gray-600'>
                {dayOfWeek}
              </span>
              <span className='text-xl sm:text-xl font-bold'>{date}</span>
              <div className='flex flex-col'>
                <span className='text-xs'>{month}</span>
                <span className='text-xs'>{year}</span>
              </div>
            </div>
            <Calendar className='size-4 shrink-0' aria-hidden />
          </div>
          <div className='flex items-center gap-2 text-accent'>
            <div className='flex items-center gap-1'>
              <span className='text-xl sm:text-2xl font-bold'>
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
