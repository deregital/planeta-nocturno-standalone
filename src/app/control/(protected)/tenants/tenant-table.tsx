'use client';

import type { ControlPermission } from '@/lib/control/permissions';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { type TenantLifecycleStatus } from '@/app/control/(protected)/tenants/actions';
import TenantActions from '@/app/control/(protected)/tenants/tenant-actions';
import EditableCommentsCell from '@/components/control/EditableCommentsCell';
import EditableCustomIdCell from '@/components/control/EditableCustomIdCell';
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

const filterStatuses = [
  'active',
  'suspended',
] as const satisfies readonly TenantLifecycleStatus[];

type SortColumn =
  | 'customId'
  | 'name'
  | 'slug'
  | 'status'
  | 'creator'
  | 'createdAt';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | (typeof filterStatuses)[number];

type TenantRow = {
  id: number;
  customId: string | null;
  comments: string | null;
  name: string;
  slug: string;
  status: TenantLifecycleStatus;
  databaseName: string | null;
  createdByUsername: string | null;
  createdAt: Date;
  recycledAt: Date | null;
  publicUrl: string;
};

export default function TenantTable({
  tenants,
  recycled = false,
  permissions,
}: {
  tenants: TenantRow[];
  recycled?: boolean;
  permissions: ControlPermission[];
}) {
  const canUpdate = permissions.includes('tenants:update');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortColumn>('createdAt');
  const [direction, setDirection] = useState<SortDirection>('desc');

  const visibleTenants = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const filtered = tenants.filter((tenant) => {
      const matchesStatus = status === 'all' || tenant.status === status;
      const matchesQuery =
        !normalizedQuery ||
        [
          tenant.customId ?? '',
          tenant.name,
          tenant.slug,
          tenant.createdByUsername ?? '',
        ].some((value) =>
          value.toLocaleLowerCase('es').includes(normalizedQuery),
        );
      return matchesStatus && matchesQuery;
    });

    return filtered.sort((first, second) => {
      const comparison =
        recycled && sort === 'createdAt'
          ? (first.recycledAt?.getTime() ?? 0) -
            (second.recycledAt?.getTime() ?? 0)
          : compareTenants(first, second, sort);
      return direction === 'asc' ? comparison : -comparison;
    });
  }, [direction, query, recycled, sort, status, tenants]);

  const hasCustomView =
    query !== '' ||
    status !== 'all' ||
    sort !== 'createdAt' ||
    direction !== 'desc';

  function toggleSort(column: SortColumn) {
    if (sort === column) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSort(column);
    setDirection(column === 'createdAt' ? 'desc' : 'asc');
  }

  function clearView() {
    setQuery('');
    setStatus('all');
    setSort('createdAt');
    setDirection('desc');
  }

  return (
    <div className='overflow-hidden rounded-xl border border-stroke bg-white shadow-sm'>
      <div className='grid gap-3 border-b border-stroke p-4 md:grid-cols-[minmax(240px,1fr)_200px_auto] md:items-end'>
        <div className='grid gap-1 text-sm font-medium text-gray-700'>
          <label htmlFor='page-filter'>Filtrar</label>
          <div className='relative'>
            <Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400' />
            <Input
              id='page-filter'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className='pl-9'
              placeholder='Buscar por ID, nombre o creador'
            />
          </div>
        </div>

        <div className='grid gap-1 text-sm font-medium text-gray-700'>
          <label htmlFor='status-filter'>Estado</label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as StatusFilter)}
          >
            <SelectTrigger id='status-filter' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos</SelectItem>
              {filterStatuses.map((value) => (
                <SelectItem key={value} value={value}>
                  {statusLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          {hasCustomView && (
            <Button type='button' variant='ghost' onClick={clearView}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                label='ID de Plataforma'
                column='customId'
                sort={sort}
                direction={direction}
                onSort={toggleSort}
              />
              <SortableTableHead
                label='Nombre'
                column='name'
                sort={sort}
                direction={direction}
                onSort={toggleSort}
              />
              <SortableTableHead
                label='Subdominio'
                column='slug'
                sort={sort}
                direction={direction}
                onSort={toggleSort}
              />
              <SortableTableHead
                label='Estado'
                column='status'
                sort={sort}
                direction={direction}
                onSort={toggleSort}
              />
              <SortableTableHead
                label='Creado por'
                column='creator'
                sort={sort}
                direction={direction}
                onSort={toggleSort}
              />
              <SortableTableHead
                label={recycled ? 'En papelera desde' : 'Creado'}
                column='createdAt'
                sort={sort}
                direction={direction}
                onSort={toggleSort}
              />
              {!recycled && <TableHead>Comentarios</TableHead>}
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <EditableCustomIdCell
                    tenantId={tenant.id}
                    customId={tenant.customId}
                    canEdit={canUpdate}
                  />
                </TableCell>
                <TableCell className='font-medium'>{tenant.name}</TableCell>
                <TableCell>
                  {recycled ? (
                    tenant.slug
                  ) : (
                    <a
                      href={`${tenant.publicUrl}/admin`}
                      target='_blank'
                      rel='noreferrer'
                      className='inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline'
                    >
                      {tenant.slug}
                      <ExternalLink className='size-3.5' />
                    </a>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[tenant.status]}`}
                  >
                    {statusLabels[tenant.status]}
                  </span>
                </TableCell>
                <TableCell>
                  {tenant.createdByUsername ?? 'Sin registrar'}
                </TableCell>
                <TableCell>
                  {new Intl.DateTimeFormat('es-AR').format(
                    recycled && tenant.recycledAt
                      ? tenant.recycledAt
                      : tenant.createdAt,
                  )}
                </TableCell>
                {!recycled && (
                  <TableCell>
                    <EditableCommentsCell
                      tenantId={tenant.id}
                      tenantName={tenant.name}
                      comments={tenant.comments}
                      canEdit={canUpdate}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <TenantActions
                    tenantId={tenant.id}
                    tenantName={tenant.name}
                    status={tenant.status}
                    databaseName={tenant.databaseName}
                    recycled={recycled}
                    permissions={permissions}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {visibleTenants.length === 0 && (
        <p className='p-8 text-center text-sm text-gray-500'>
          {tenants.length === 0
            ? recycled
              ? 'La papelera está vacía.'
              : 'Todavía no hay plataformas registradas.'
            : 'No hay plataformas que coincidan con los filtros.'}
        </p>
      )}
    </div>
  );
}

function SortableTableHead({
  label,
  column,
  sort,
  direction,
  onSort,
}: {
  label: string;
  column: SortColumn;
  sort: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const active = sort === column;

  return (
    <TableHead
      aria-sort={
        active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <button
        type='button'
        className='inline-flex cursor-pointer items-center gap-1.5 hover:text-accent-dark'
        onClick={() => onSort(column)}
      >
        {label}
        {!active && <ArrowUpDown className='size-3.5' />}
        {active && direction === 'asc' && <ArrowUp className='size-3.5' />}
        {active && direction === 'desc' && <ArrowDown className='size-3.5' />}
      </button>
    </TableHead>
  );
}

function compareTenants(
  first: TenantRow,
  second: TenantRow,
  column: SortColumn,
) {
  if (column === 'createdAt') {
    return first.createdAt.getTime() - second.createdAt.getTime();
  }

  const firstValue = getSortValue(first, column);
  const secondValue = getSortValue(second, column);
  return firstValue.localeCompare(secondValue, 'es', {
    sensitivity: 'base',
    numeric: true,
  });
}

function getSortValue(
  tenant: TenantRow,
  column: Exclude<SortColumn, 'createdAt'>,
) {
  if (column === 'creator') return tenant.createdByUsername ?? '';
  return tenant[column] ?? '';
}
