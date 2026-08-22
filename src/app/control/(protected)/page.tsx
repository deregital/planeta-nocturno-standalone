import { and, asc, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { Plus, Search } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import TenantActions from '@/app/control/(protected)/tenants/tenant-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  active: 'Activa',
  suspended: 'Suspendida',
  failed: 'Fallida',
  deleting: 'Eliminando',
  deleted: 'Eliminada',
} as const;

const statusStyles = {
  provisioning: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-gray-200 text-gray-700',
  failed: 'bg-red-100 text-red-800',
  deleting: 'bg-red-100 text-red-800',
  deleted: 'bg-gray-200 text-gray-700',
} as const;

const sortOptions = {
  newest: { label: 'Más recientes', orderBy: desc(tenants.createdAt) },
  oldest: { label: 'Más antiguas', orderBy: asc(tenants.createdAt) },
  nameAsc: { label: 'ID de Página: A–Z', orderBy: asc(tenants.name) },
  nameDesc: { label: 'ID de Página: Z–A', orderBy: desc(tenants.name) },
  status: { label: 'Estado', orderBy: asc(tenants.status) },
} as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ControlHomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = readParam(params.q).trim();
  const status = readStatus(params.status);
  const sort = readSort(params.sort);
  const searchPattern = `%${query}%`;

  const tenantList = await getControlDb()
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      status: tenants.status,
      databaseName: tenants.databaseName,
      createdByControlAdminId: tenants.createdByControlAdminId,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(
      and(
        ne(tenants.status, 'deleted'),
        status ? eq(tenants.status, status) : undefined,
        query
          ? or(
              ilike(tenants.name, searchPattern),
              ilike(tenants.slug, searchPattern),
              ilike(
                sql<string>`cast(${tenants.createdByControlAdminId} as text)`,
                searchPattern,
              ),
            )
          : undefined,
      ),
    )
    .orderBy(sortOptions[sort].orderBy);

  const activeTenants = tenantList.filter(
    (tenant) => tenant.status === 'active',
  ).length;
  const hasFilters = Boolean(query || status);

  return (
    <div className='space-y-6'>
      <div className='flex items-end justify-between gap-4'>
        <div>
          <p className='text-sm font-medium text-accent'>
            Administrador de páginas
          </p>
          <h1 className='text-3xl font-bold text-gray-900'>Páginas</h1>
          <p className='mt-1 text-sm text-gray-600'>
            {tenantList.length} {hasFilters ? 'resultados' : 'registradas'} ·{' '}
            {activeTenants} activas
          </p>
        </div>
        <Button asChild>
          <Link href={'/tenants/new' as Route}>
            <Plus />
            Nueva página
          </Link>
        </Button>
      </div>

      <div className='overflow-hidden rounded-xl border border-stroke bg-white shadow-sm'>
        <form className='grid gap-3 border-b border-stroke p-4 md:grid-cols-[minmax(240px,1fr)_180px_200px_auto] md:items-end'>
          <label className='space-y-1 text-sm font-medium text-gray-700'>
            <span>Filtrar</span>
            <Input
              name='q'
              defaultValue={query}
              placeholder='ID de Página, subdominio o creador'
            />
          </label>

          <label className='space-y-1 text-sm font-medium text-gray-700'>
            <span>Estado</span>
            <select
              name='status'
              defaultValue={status ?? ''}
              className='h-9 w-full rounded-md border border-stroke bg-white px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-stroke/50'
            >
              <option value=''>Todos</option>
              {Object.entries(statusLabels)
                .filter(([value]) => value !== 'deleted')
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>

          <label className='space-y-1 text-sm font-medium text-gray-700'>
            <span>Ordenar por</span>
            <select
              name='sort'
              defaultValue={sort}
              className='h-9 w-full rounded-md border border-stroke bg-white px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-stroke/50'
            >
              {Object.entries(sortOptions).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className='flex gap-2'>
            <Button type='submit'>
              <Search />
              Aplicar
            </Button>
            {(hasFilters || sort !== 'newest') && (
              <Button asChild type='button' variant='ghost'>
                <Link href='/'>Limpiar</Link>
              </Button>
            )}
          </div>
        </form>

        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID de Página</TableHead>
                <TableHead>Subdominio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado por</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Acciones</TableHead>
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
                  <TableCell className='font-mono text-xs'>
                    {tenant.createdByControlAdminId ?? 'Sin registrar'}
                  </TableCell>
                  <TableCell>
                    {new Intl.DateTimeFormat('es-AR').format(tenant.createdAt)}
                  </TableCell>
                  <TableCell>
                    <TenantActions
                      tenantId={tenant.id}
                      tenantName={tenant.name}
                      status={tenant.status}
                      databaseName={tenant.databaseName}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {tenantList.length === 0 && (
          <p className='p-8 text-center text-sm text-gray-500'>
            {hasFilters
              ? 'No hay páginas que coincidan con los filtros.'
              : 'Todavía no hay páginas registradas.'}
          </p>
        )}
      </div>
    </div>
  );
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function readStatus(value: string | string[] | undefined) {
  const status = readParam(value);
  if (status === 'deleted' || !Object.hasOwn(statusLabels, status)) return null;
  return status as Exclude<keyof typeof statusLabels, 'deleted'>;
}

function readSort(value: string | string[] | undefined) {
  const sort = readParam(value);
  return Object.hasOwn(sortOptions, sort)
    ? (sort as keyof typeof sortOptions)
    : 'newest';
}
