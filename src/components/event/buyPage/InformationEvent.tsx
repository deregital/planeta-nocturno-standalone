import { type RouterOutputs } from '@/server/routers/app';

interface InformationEventProps {
  description: RouterOutputs['events']['getById']['description'];
}
function InformationEvent({ description }: InformationEventProps) {
  return (
    <div className='h-[calc(100%-16px)] bg-white rounded-[20px] w-full mb-4 md:mb-0'>
      <div className='flex flex-col items-center justify-start px-4 py-6'>
        <h1 className='font-bold text-[16px] text-black leading-[100%] font-sans mb-3'>
          Información del evento
        </h1>
        <p className='text-[16px] text-center text-black leading-[100%] font-light font-sans mb-10'>
          {description}
        </p>
      </div>
    </div>
  );
}

export default InformationEvent;
