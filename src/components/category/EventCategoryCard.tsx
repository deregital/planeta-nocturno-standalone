import EventCategoryModal from '@/components/category/EventCategoryModal';
import { type EventCategory } from '@/server/schemas/event-category';

export default function EventCategoryCard({
  category,
}: {
  category: EventCategory;
}) {
  return (
    <div className='rounded-md p-2 flex gap-2 items-center bg-accent text-on-accent pl-4'>
      {category.name}
      <EventCategoryModal action='EDIT' category={category} />
    </div>
  );
}
