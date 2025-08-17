import { trpc } from '@/server/trpc/server';

export default async function Events() {
  const events = await trpc.events.getAll();

  return (
    <ul className='gap-4'>
      <li
        key='names'
        className='grid grid-cols-3 gap-4 border font-bold  bg-pn-accent/30'
      >
        <p>Nombre</p>
        <p>Descripción</p>
        <p>Slug</p>
      </li>
      {events.map((event, index) => (
        <li key={index} className='grid grid-cols-3 gap-4 border'>
          <p>{event.name}</p>
          <p>{event.description}</p>
          <p>{event.slug}</p>
        </li>
      ))}
    </ul>
  );
}
