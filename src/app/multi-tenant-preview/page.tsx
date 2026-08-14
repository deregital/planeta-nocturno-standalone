export default function MultiTenantPreviewPage() {
  return (
    <main className='flex min-h-screen items-center justify-center p-6'>
      <div className='max-w-xl text-center'>
        <p className='mb-2 text-sm font-medium uppercase'>Planeta Nocturno</p>
        <h1 className='text-3xl font-bold'>Instancia multi-tenant</h1>
        <p className='mt-4 text-base text-gray-600'>
          Prueba de instancia multi-tenant. Sin aprovisionamiento de tenants
          todavía.
        </p>
      </div>
    </main>
  );
}
