import ErrorCard from '@/components/common/ErrorCard';

export default async function NotFound() {
  return (
    <ErrorCard
      title='Esta página no existe'
      description='La página que buscas no existe. Verificá que el enlace sea correcto.'
      route='/'
    />
  );
}
