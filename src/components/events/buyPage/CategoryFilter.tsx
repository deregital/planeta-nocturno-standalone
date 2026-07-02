'use client';

import { parseAsString, useQueryState } from 'nuqs';

import { cn } from '@/lib/utils';
import { trpc } from '@/server/trpc/client';

export function CategoryFilter() {
  const { data: categories } = trpc.eventCategory.getActive.useQuery();
  const [selectedCategory, setSelectedCategory] = useQueryState(
    'cat',
    parseAsString,
  );

  if (!categories || categories.length === 0) return null;

  return (
    <div className='mt-2 min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain scrollbar-none'>
      <div className='inline-flex gap-2 pb-1 sm:flex sm:flex-wrap sm:w-full'>
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'cursor-pointer shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
            !selectedCategory
              ? 'bg-accent text-on-accent border-accent'
              : 'bg-transparent text-foreground border-border hover:bg-accent/20',
          )}
        >
          Todos
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() =>
              setSelectedCategory(
                selectedCategory === category.id ? null : category.id,
              )
            }
            className={cn(
              'cursor-pointer shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
              selectedCategory === category.id
                ? 'bg-accent text-on-accent border-accent'
                : 'bg-transparent text-foreground border-border hover:bg-accent/20',
            )}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
}
