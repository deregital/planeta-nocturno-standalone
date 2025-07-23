import GridEvents from '@/components/events/GridEvents';

export default async function Home() {
  return (
    <div className='h-full flex items-center justify-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]'>
      <GridEvents />
    </div>
  );
}
