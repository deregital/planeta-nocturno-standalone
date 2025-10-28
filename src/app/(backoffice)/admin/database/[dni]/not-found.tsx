import ErrorCard from '@/components/common/ErrorCard';

export default async function NotFound() {
  return (
    <ErrorCard
      title='No se encontró la persona'
      description='La persona no se encontró en la base de datos. Verificá que el DNI sea correcto.'
      route='/admin/database'
    />
  );
}
