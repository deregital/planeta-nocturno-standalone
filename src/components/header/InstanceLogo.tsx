function InstanceLogo({ firstWord, rest }: { firstWord: string; rest: string }) {
  return (
    <h1 className='text-[1.5rem] md:text-[2.5rem] lg:text-[4rem] font-sans font-bold leading-[80px]'>
      <span className='text-pn-accent'>{firstWord}</span>
      <span className='text-pn-secondary'>{rest}</span>
    </h1>
  );
}

export default InstanceLogo;
