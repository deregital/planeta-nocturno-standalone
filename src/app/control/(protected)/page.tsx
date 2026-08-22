import { and, asc, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Search } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import TenantActions from '@/app/control/(protected)/tenants/tenant-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const sortColumns = {
  name: tenants.name,
  slug: tenants.slug,
  status: tenants.status,
  creator: tenants.createdByControlAdminId,
  createdAt: tenants.createdAt,
} as const;

type SortColumn = keyof typeof sortColumns;
type SortDirection = 'asc' | 'desc';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ControlHomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = readParam(params.q).trim();
  const status = readStatus(params.status);
  const sort = readSortColumn(params.sort);
  const direction = readSortDirection(params.direction);
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
    .orderBy(
      direction === 'asc' ? asc(sortColumns[sort]) : desc(sortColumns[sort]),
    );

  const activeTenants = tenantList.filter(
    (tenant) => tenant.status === 'active',
  ).length;
  const hasFilters = Boolean(query || status);
  const currentSort = { sort, direction, query, status };

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
        <form className='grid gap-3 border-b border-stroke p-4 md:grid-cols-[minmax(240px,1fr)_200px_auto] md:items-end'>
          <input type='hidden' name='sort' value={sort} />
          <input type='hidden' name='direction' value={direction} />

          <div className='grid gap-1 text-sm font-medium text-gray-700'>
            <label htmlFor='page-filter'>Filtrar</label>
            <Input
              id='page-filter'
              name='q'
              defaultValue={query}
              placeholder='ID de Página, subdominio o creador'
            />
          </div>

          <div className='grid gap-1 text-sm font-medium text-gray-700'>
            <label htmlFor='status-filter'>Estado</label>
            <Select name='status' defaultValue={status ?? 'all'}>
              <SelectTrigger id='status-filter' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos</SelectItem>
                {Object.entries(statusLabels)
                  .filter(([value]) => value !== 'deleted')
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex gap-2'>
            <Button type='submit'>
              <Search />
              Aplicar
            </Button>
            {(hasFilters || sort !== 'createdAt' || direction !== 'desc') && (
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
                <SortableTableHead
                  label='ID de Página'
                  column='name'
                  {...currentSort}
                />
                <SortableTableHead
                  label='Subdominio'
                  column='slug'
                  {...currentSort}
                />
                <SortableTableHead
                  label='Estado'
                  column='status'
                  {...currentSort}
                />
                <SortableTableHead
                  label='Creado por'
                  column='creator'
                  {...currentSort}
                />
                <SortableTableHead
                  label='Creado'
                  column='createdAt'
                  {...currentSort}
                />
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

function readSortColumn(value: string | string[] | undefined): SortColumn {
  const sort = readParam(value);
  return Object.hasOwn(sortColumns, sort) ? (sort as SortColumn) : 'createdAt';
}

function readSortDirection(
  value: string | string[] | undefined,
): SortDirection {
  const direction = readParam(value);
  return direction === 'asc' || direction === 'desc' ? direction : 'desc';
}

function SortableTableHead({
  label,
  column,
  sort,
  direction,
  query,
  status,
}: {
  label: string;
  column: SortColumn;
  sort: SortColumn;
  direction: SortDirection;
  query: string;
  status: ReturnType<typeof readStatus>;
}) {
  const active = sort === column;
  const nextDirection = active && direction === 'asc' ? 'desc' : 'asc';
  const params = new URLSearchParams({
    sort: column,
    direction: nextDirection,
  });
  if (query) params.set('q', query);
  if (status) params.set('status', status);

  return (
    <TableHead
      aria-sort={
        active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <Link
        href={`/?${params.toString()}` as Route}
        className='inline-flex items-center gap-1.5 hover:text-accent-dark'
      >
        {label}
        {!active && <ArrowUpDown className='size-3.5' />}
        {active && direction === 'asc' && <ArrowUp className='size-3.5' />}
        {active && direction === 'desc' && <ArrowDown className='size-3.5' />}
      </Link>
    </TableHead>
  );
}
