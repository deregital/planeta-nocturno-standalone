import { getTextColorByBg } from '@/lib/control/tag-colors';
import { cn } from '@/lib/utils';

export default function TenantTagBadge({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-40 min-w-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        className,
      )}
      style={{ backgroundColor: color, color: getTextColorByBg(color) }}
      title={name}
    >
      <span className='min-w-0 truncate'>{name}</span>
    </span>
  );
}
