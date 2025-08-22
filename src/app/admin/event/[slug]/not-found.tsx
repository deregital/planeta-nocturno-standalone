export default function NotFound() {
  return (
    <div className='flex h-full w-full items-center justify-center'>
      <div className='flex flex-col items-center justify-center'>
        <h1 className='text-2xl font-bold'>Evento no encontrado</h1>
        <p className='text-sm text-gray-500'>El evento que buscas no existe.</p>
      </div>
    </div>
  );
}
