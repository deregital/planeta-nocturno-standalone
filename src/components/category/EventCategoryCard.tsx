import { type EventCategory } from '@/server/schemas/event-category';
import EventCategoryModal from '@/components/category/EventCategoryModal';

export default function EventCategoryCard({
  category,
}: {
  category: EventCategory;
}) {
  return (
    <div className='rounded-md p-2 flex gap-2 items-center bg-accent text-on-accent'>
      {category.name}
      <EventCategoryModal action='EDIT' category={category} />
    </div>
  );
}
