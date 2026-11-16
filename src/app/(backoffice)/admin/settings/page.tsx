import CategoryList from '@/components/admin/category/CategoryList';
import { CreateUserForm } from '@/components/admin/config/CreateUserForm';
import UpdateFeatures from '@/components/admin/config/UpdateFeatures';
import { UsersTable } from '@/components/admin/config/UsersTable';
import MercadoPagoOAuth from '@/components/admin/oauth/MercadoPagoOAuth';
import { TransferAliasForm } from '@/components/admin/oauth/TransferAliasField';
import { PaymentMethodList } from '@/components/admin/payments/PaymentMethodList';
import LocationList from '@/components/location/LocationList';
import { SETTINGS_PAGE_PERMISSIONS } from '@/lib/rbac/navigation';
import { hasPermission, type TenantPermission } from '@/lib/rbac/permissions';
import { requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';

export default async function Page() {
  const access = await requirePagePermission(SETTINGS_PAGE_PERMISSIONS, {
    mode: 'any',
  });
  const can = (permission: TenantPermission) =>
    hasPermission(access.permissions, permission);

  const data = can('users:read') ? await trpc.user.getAll() : [];

  return (
    <div className='flex flex-col gap-4 py-4'>
      {can('users:read') && (
        <section className='mb-4 space-y-4'>
          <div className='flex justify-between items-center px-4'>
            <h2 className='text-3xl font-bold text-accent'>Usuarios</h2>
            {can('users:create') && <CreateUserForm />}
          </div>
          <UsersTable data={data.filter((user) => !user.isOrganizer)} />
        </section>
      )}
      {can('locations:read') && <LocationList />}
      {can('categories:read') && <CategoryList />}
      {can('settings:read') && (
        <section className='mb-4 mx-4 space-y-4'>
          <h2 className='text-2xl font-bold'>Configuraciones adicionales</h2>
          <UpdateFeatures />
        </section>
      )}
      {can('payments:manage') && (
        <section id='medios-de-pago' className='mb-4 mx-4 space-y-4'>
          <div className='space-y-1'>
            <h2 className='text-2xl font-bold'>Medios de pago</h2>
            <p className='text-sm text-muted-foreground'>
              Las entradas se cobran con el primer medio activo de la lista. Si
              ese falla, se pasa al siguiente.
            </p>
          </div>
          <PaymentMethodList
            initialMethods={await trpc.payments.methods()}
            details={{
              MERCADO_PAGO: (
                <MercadoPagoOAuth canUnlink={can('payments:unlink')} />
              ),
              TRANSFER: <TransferAliasForm />,
            }}
          />
        </section>
      )}
    </div>
  );
}
