import Link from 'next/link';

import { useInstance } from '@/components/instance/InstanceProvider';
import { cn } from '@/lib/utils';

function InstanceLogo({ size }: { size: 'sm' | 'lg' }) {
  const { name } = useInstance();
  const [firstWord, ...rest] = name.split(' ');

  return (
    <Link
      href='/'
      className={cn(
        'font-bold leading-[80px]',
        size === 'sm'
          ? 'text-2xl md:text-3xl'
          : 'text-[1.5rem] md:text-[2.5rem] lg:text-[4rem]',
      )}
    >
      <span className='text-brand'>{firstWord}</span>
      <span className='text-on-accent'>{rest.join(' ')}</span>
    </Link>
  );
}

export default InstanceLogo;
