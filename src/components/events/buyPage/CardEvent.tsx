import Image from 'next/image';
import { Calendar, Clock } from 'lucide-react';

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
      className={`bg-white rounded-3xl overflow-hidden drop-shadow-md ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:shadow-[0_0_15px_8px_rgba(0,0,0,0.1)] hover:cursor-pointer'} transition-all duration-300 w-[150px] sm:w-[240px]`}
    >
      <div
        className={`relative h-[120px] sm:h-[180px] w-full ${disabled ? 'bg-gray-300' : 'bg-pn-purple/10'}`}
      >
        <Image src={imageUrl} alt={title} fill className='object-cover' />
      </div>
      <div className='px-2 sm:px-4 py-2 sm:py-8 font-sans'>
        <h3 className='text-[14px] sm:text-[18px] font-light text-black mb-2 sm:mb-5'>
          {title}
        </h3>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-1'>
              <span className='hidden sm:inline text-xs text-gray-600'>
                {dayOfWeek}
              </span>
              <span className='text-3xl sm:text-2xl font-bold'>{date}</span>
              <div className='flex flex-col'>
                <span className='text-[10px]'>{month}</span>
                <span className='text-[10px]'>{year}</span>
              </div>
            </div>
            <Calendar size={16} />
          </div>
          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-1'>
              <span className='text-3xl sm:text-2xl font-bold'>
                {time.split(':')[0]}{' '}
              </span>
              <div className='flex flex-col'>
                <span className='text-[10px]'>
                  {time.includes(':') ? time.split(':')[1] : '00'}
                </span>
                <span className='text-[10px]'>hs</span>
              </div>
            </div>
            <Clock size={16} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CardEvent;
