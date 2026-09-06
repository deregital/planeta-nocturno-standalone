import Link from 'next/link';

import { useInstance } from '@/components/instance/InstanceProvider';
import { cn } from '@/lib/utils';

function InstanceLogo({ size }: { size: 'sm' | 'lg' }) {
  const { name, faviconUrl } = useInstance();
  const [firstWord, ...rest] = name.split(' ');

  return (
    <Link
      href='/'
      className={cn(
        'flex items-center font-bold leading-20',
        size === 'sm' ? 'gap-2' : 'gap-4',
        size === 'sm'
          ? 'text-2xl md:text-3xl'
          : 'text-[1.5rem] md:text-[2.5rem] lg:text-[4rem]',
      )}
    >
      <img
        src={faviconUrl ?? '/icon.ico'}
        alt=''
        className={cn(
          'shrink-0 object-contain',
          size === 'sm' ? 'size-9' : 'size-16',
        )}
      />
      <span>
        <span className='text-brand'>{firstWord}</span>
        <span className='text-on-accent'>{rest.join(' ')}</span>
      </span>
    </Link>
  );
}

export default InstanceLogo;
