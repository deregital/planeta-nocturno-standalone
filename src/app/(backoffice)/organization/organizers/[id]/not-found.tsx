import ErrorCard from '@/components/common/ErrorCard';

export default function NotFound() {
  return (
    <ErrorCard
      title='Usuario no encontrado'
      description='El usuario que buscas no existe. Verificá que el enlace sea correcto.'
      route='/organization/organizers'
    />
  );
}
