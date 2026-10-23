'use client';

import { Loader2 } from 'lucide-react';
import { type Route } from 'next';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { usePermissions } from '@/components/rbac/PermissionsProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  getPermissionDefinition,
  getPermissionDepth,
  groupPermissionsByModule,
  isCapability,
  type TenantPermission,
  togglePermission,
} from '@/lib/rbac/permissions';
import { cn } from '@/lib/utils';
import { trpc } from '@/server/trpc/client';

export type RoleFormValues = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: TenantPermission[];
};

const ROLES_PATH = '/admin/roles' as Route;
const permissionGroups = groupPermissionsByModule();

export default function RoleForm({
  mode,
  initialValues,
}: {
  mode: 'create' | 'edit';
  initialValues?: RoleFormValues;
}) {
  const router = useRouter();
  const { can } = usePermissions();

  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  );
  const [selected, setSelected] = useState<TenantPermission[]>(
    initialValues?.permissions ?? [],
  );

  const initialPermissions = useMemo(
    () => new Set(initialValues?.permissions ?? []),
    [initialValues?.permissions],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const canGrant = (permission: TenantPermission) =>
    can(permission) ||
    initialPermissions.has(permission) ||
    isCapability(permission);

  const onSuccess = () => {
    toast.success(
      mode === 'create'
        ? 'Rol creado correctamente'
        : 'Rol actualizado correctamente',
    );
    router.push(ROLES_PATH);
    router.refresh();
  };
  const onError = (error: { message: string }) => {
    toast.error(error.message);
  };

  const createRole = trpc.accessRole.create.useMutation({ onSuccess, onError });
  const updateRole = trpc.accessRole.update.useMutation({ onSuccess, onError });
  const isPending = createRole.isPending || updateRole.isPending;

  function handleToggle(permission: TenantPermission, enabled: boolean) {
    setSelected((current) => togglePermission(current, permission, enabled));
  }

  function handleToggleModule(
    permissions: TenantPermission[],
    enabled: boolean,
  ) {
    setSelected((current) =>
      permissions
        .filter((permission) => !enabled || canGrant(permission))
        .reduce(
          (acc, permission) => togglePermission(acc, permission, enabled),
          current,
        ),
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (mode === 'create') {
      createRole.mutate({ name, description, permissions: selected });
    } else if (initialValues) {
      updateRole.mutate({
        id: initialValues.id,
        name,
        description,
        permissions: selected,
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-6'>
      <fieldset className='grid gap-5 rounded-xl border border-stroke bg-white p-6 md:grid-cols-2'>
        <legend className='px-2 text-lg font-semibold'>Rol</legend>

        <div className='flex flex-col gap-1'>
          <Label htmlFor='name'>Nombre</Label>
          <Input
            id='name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={60}
            disabled={initialValues?.isSystem}
            placeholder='ej. Boletería sin reportes'
          />
          {initialValues?.isSystem && (
            <p className='text-xs text-muted-foreground'>
              El nombre de los roles de sistema no se puede cambiar.
            </p>
          )}
        </div>

        <div className='flex flex-col gap-1 md:col-span-2'>
          <Label htmlFor='description'>Descripción</Label>
          <Textarea
            id='description'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={240}
            placeholder='Breve descripción de qué puede hacer este rol'
          />
        </div>
      </fieldset>

      <fieldset className='flex flex-col gap-5 rounded-xl border border-stroke bg-white p-6'>
        <legend className='px-2 text-lg font-semibold'>
          Permisos ({selected.length})
        </legend>
        <p className='text-sm text-muted-foreground'>
          Activar un permiso activa también los permisos de los que depende;
          desactivarlo desactiva los que dependen de él. Las capacidades indican
          qué es el usuario dentro del negocio (por ejemplo, organizador) y
          habilitan los permisos que dependen de ellas.
        </p>

        {permissionGroups.map((group) => {
          const grantable = group.permissions.filter(canGrant);
          const allSelected =
            grantable.length > 0 &&
            grantable.every((permission) => selectedSet.has(permission));

          return (
            <section key={group.module} className='flex flex-col gap-3'>
              <div className='flex items-center justify-between gap-3 border-b border-stroke pb-2'>
                <h3 className='text-sm font-semibold'>{group.label}</h3>
                <label className='flex cursor-pointer items-center gap-2 text-xs text-muted-foreground'>
                  <span>Todos</span>
                  <Switch
                    checked={allSelected}
                    disabled={grantable.length === 0}
                    onCheckedChange={(checked) =>
                      handleToggleModule(group.permissions, checked)
                    }
                  />
                </label>
              </div>
              <div className='flex flex-col gap-2'>
                {group.permissions.map((permission) => {
                  const definition = getPermissionDefinition(permission);
                  const checked = selectedSet.has(permission);
                  const disabled = !checked && !canGrant(permission);
                  return (
                    <label
                      key={permission}
                      style={{
                        marginLeft: `${getPermissionDepth(permission) * 1.5}rem`,
                      }}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-lg border border-stroke p-3',
                        checked && 'bg-accent-ultra-light',
                        disabled
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer hover:bg-accent-ultra-light',
                      )}
                      title={
                        disabled
                          ? 'No podés otorgar un permiso que no tenés'
                          : undefined
                      }
                    >
                      <span className='flex flex-col'>
                        <span className='flex items-center gap-2 text-sm font-medium'>
                          {definition.label}
                          {isCapability(permission) && (
                            <Badge variant='outline'>Capacidad</Badge>
                          )}
                        </span>
                        {definition.description && (
                          <span className='text-xs text-muted-foreground'>
                            {definition.description}
                          </span>
                        )}
                      </span>
                      <Switch
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) =>
                          handleToggle(permission, value)
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </fieldset>

      <div className='flex gap-2'>
        <Button type='submit' disabled={isPending}>
          {isPending && <Loader2 className='animate-spin' />}
          {mode === 'create' ? 'Crear rol' : 'Guardar cambios'}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => router.push(ROLES_PATH)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
