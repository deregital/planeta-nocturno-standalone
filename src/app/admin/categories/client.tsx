import EventCategoryCard from '@/components/category/EventCategoryCard';
import EventCategoryModal from '@/components/category/EventCategoryModal';
import { type EventCategory } from '@/server/schemas/event-category';

export default function Client({
  categories,
}: {
  categories: EventCategory[];
}) {
  return (
    <div className='p-4'>
      <h1 className='text-4xl font-bold text-accent'>Categorías</h1>
      <EventCategoryModal action='CREATE' />
      <div className='flex flex-wrap gap-4'>
        {categories &&
          categories.map((category, index) => (
            <EventCategoryCard category={category} key={index} />
          ))}
      </div>
    </div>
  );
}
