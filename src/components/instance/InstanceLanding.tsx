type InstanceLandingProps = {
  name: string;
  description: string | null;
};

export function InstanceLanding({ name, description }: InstanceLandingProps) {
  return (
    <main className='relative flex h-main-screen items-center justify-center overflow-hidden bg-accent-ultra-light px-6 py-16'>
      <div
        aria-hidden='true'
        className='absolute size-[28rem] rounded-full bg-brand opacity-20 blur-3xl'
      />
      <div className='relative mx-auto max-w-2xl text-center'>
        <h1 className='text-4xl font-bold tracking-tight text-accent sm:text-6xl'>
          {name}
        </h1>
        {description ? (
          <p className='mt-6 text-lg text-accent/80 sm:text-xl'>
            {description}
          </p>
        ) : null}
      </div>
    </main>
  );
}
