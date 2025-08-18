import GridEvents from '@/components/events/buyPage/GridEvents';

export default async function Home() {
  return (
    <div className='h-main-screen flex justify-center p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]'>
      <GridEvents />
    </div>
  );
}
