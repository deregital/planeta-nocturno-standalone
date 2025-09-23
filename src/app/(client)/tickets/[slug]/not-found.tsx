import ErrorCard from '@/components/common/ErrorCard';

export default function NotFound() {
  return (
    <div className='flex justify-center items-center h-main-screen'>
      <ErrorCard
        title='Entrada no encontrada'
        description='La entrada que buscás no existe. Asegurate de que el enlace sea correcto o volvé a intentarlo desde la página principal.'
        route='/'
      />
    </div>
  );
}
