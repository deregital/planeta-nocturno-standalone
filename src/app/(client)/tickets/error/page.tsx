import ErrorCard from '@/components/common/ErrorCard';

export default function Page() {
  return (
    <ErrorCard
      title='Ha ocurrido un error'
      description='Algo salió mal, probablemente durante el proceso de pago. Intentá nuevamente.'
      route='/'
    />
  );
}
