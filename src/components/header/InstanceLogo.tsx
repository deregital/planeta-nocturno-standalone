import Link from 'next/link';

import { useInstance } from '@/components/instance/InstanceProvider';
import { cn } from '@/lib/utils';

function InstanceLogo({ size }: { size: 'sm' | 'lg' }) {
  const { name, faviconUrl } = useInstance();
  const [firstWord, ...rest] = name.split(' ');
  const iconUrl = faviconUrl?.trim() || null;

  return (
    <Link
      href='/'
      className={cn(
        'flex min-w-0 items-center font-bold leading-20',
        size === 'sm' ? 'gap-2' : 'gap-4',
        size === 'sm'
          ? 'text-2xl md:text-3xl'
          : 'text-[1.5rem] md:text-[2.5rem] lg:text-[4rem]',
      )}
    >
      {iconUrl && (
        <img
          src={iconUrl}
          alt=''
          className={cn(
            'shrink-0 object-contain',
            size === 'sm' ? 'size-9' : 'size-16',
          )}
        />
      )}
      {/* Un nombre de productora largo se corta con "…" en vez de empujar el
          header fuera de la pantalla. */}
      <span className={cn('min-w-0', size === 'sm' && 'truncate')}>
        <span className='text-brand'>{firstWord}</span>
        <span className='text-on-accent'>{rest.join(' ')}</span>
      </span>
    </Link>
  );
}

export default InstanceLogo;
