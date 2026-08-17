import { desc } from 'drizzle-orm';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';

const statusLabels = {
  provisioning: 'Preparando',
  active: 'Activo',
  suspended: 'Suspendido',
  failed: 'Fallido',
  deleting: 'Eliminando',
} as const;

const statusStyles = {
  provisioning: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-gray-200 text-gray-700',
  failed: 'bg-red-100 text-red-800',
  deleting: 'bg-red-100 text-red-800',
} as const;

export default async function ControlHomePage() {
  const tenantList = await getControlDb()
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      plan: tenants.plan,
      status: tenants.status,
      databaseName: tenants.databaseName,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));

  const activeTenants = tenantList.filter(
    (tenant) => tenant.status === 'active',
  ).length;

  return (
    <div className='space-y-6'>
      <div>
        <p className='text-sm font-medium text-accent'>Control plane</p>
        <h1 className='text-3xl font-bold text-gray-900'>Tenants</h1>
        <p className='mt-1 text-sm text-gray-600'>
          {tenantList.length} registrados · {activeTenants} activos
        </p>
      </div>

      <div className='overflow-hidden rounded-xl border border-stroke bg-white shadow-sm'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Base de datos</TableHead>
              <TableHead>Creado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenantList.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className='font-medium'>{tenant.name}</TableCell>
                <TableCell>{tenant.slug}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[tenant.status]}`}
                  >
                    {statusLabels[tenant.status]}
                  </span>
                </TableCell>
                <TableCell className='uppercase'>{tenant.plan}</TableCell>
                <TableCell>{tenant.databaseName ?? 'Sin asignar'}</TableCell>
                <TableCell>
                  {new Intl.DateTimeFormat('es-AR').format(tenant.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {tenantList.length === 0 && (
          <p className='p-8 text-center text-sm text-gray-500'>
            Todavía no hay tenants registrados.
          </p>
        )}
      </div>
    </div>
  );
}
