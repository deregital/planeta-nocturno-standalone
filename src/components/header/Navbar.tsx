'use client';

import { useRouter } from 'next/navigation';

function Navbar() {
  const router = useRouter();

  return (
    <div className='pl-10 sm:pl-14 flex items-center gap-x-[40px] sm:gap-x-[80px]'>
      <button onClick={() => router.push('/')}>
        <h3 className='text-secondary hover:cursor-pointer text-[1rem] sm:text-[1.2rem] lg:text-[1.5rem] font-sans leading-[32px] relative group'>
          Eventos
          <span className='absolute bottom-0 left-0 w-0 h-[2px] bg-pn-secondary transition-all duration-300 group-hover:w-full'></span>
        </h3>
      </button>
    </div>
  );
}

export default Navbar;
