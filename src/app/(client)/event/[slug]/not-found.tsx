import ErrorCard from '@/components/common/ErrorCard';

export default function NotFound() {
  return (
    <ErrorCard
      title='Evento no encontrado'
      description='El evento que buscas no existe. Verificá que el enlace sea correcto.'
      route='/event'
    />
  );
}
