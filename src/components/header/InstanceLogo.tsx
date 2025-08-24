import { cn } from '@/lib/utils';

function InstanceLogo({ size }: { size: 'sm' | 'lg' }) {
  const [firstWord, ...rest] =
    process.env.NEXT_PUBLIC_INSTANCE_NAME!.split(' ');

  return (
    <p
      className={cn(
        'font-bold leading-[80px]',
        size === 'sm'
          ? 'text-2xl md:text-3xl'
          : 'text-[1.5rem] md:text-[2.5rem] lg:text-[4rem]',
      )}
    >
      <span className='text-pn-accent'>{firstWord}</span>
      <span className='text-pn-secondary'>{rest}</span>
    </p>
  );
}

export default InstanceLogo;
