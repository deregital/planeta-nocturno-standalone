import ErrorCard from '@/components/common/ErrorCard';

export default async function NotFound() {
  return (
    <ErrorCard
      title='Pagina de administrador no encontrada'
      description='La pagina que buscas no existe. Verificá que el enlace sea correcto.'
      route='/admin'
    />
  );
}
