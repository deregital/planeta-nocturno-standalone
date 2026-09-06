'use client';

import { useActionState, useState } from 'react';

import {
  type ControlRoleFormState,
  type ControlRoleFormValues,
  createControlRole,
  updateControlRole,
} from '@/app/control/(protected)/roles/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  CONTROL_PERMISSION_LABELS,
  groupControlPermissionsByCategory,
  type ControlPermission,
} from '@/lib/control/permissions';

const permissionGroups = groupControlPermissionsByCategory();

export default function ControlRoleForm({
  mode,
  initialValues,
}: {
  mode: 'create' | 'edit';
  initialValues?: ControlRoleFormValues;
}) {
  const actionFn = mode === 'create' ? createControlRole : updateControlRole;
  const [state, action, pending] = useActionState<
    ControlRoleFormState,
    FormData
  >(actionFn, {});
  const values = {
    name: '',
    description: '',
    permissions: [] as ControlPermission[],
    ...initialValues,
    ...state.values,
  };
  const [selected, setSelected] = useState<ControlPermission[]>(
    values.permissions,
  );

  function togglePermission(permission: ControlPermission, checked: boolean) {
    setSelected((current) =>
      checked
        ? [...current, permission]
        : current.filter((value) => value !== permission),
    );
  }

  function toggleCategory(permissions: ControlPermission[], checked: boolean) {
    setSelected((current) => {
      if (checked) {
        return [...new Set([...current, ...permissions])];
      }
      const remove = new Set(permissions);
      return current.filter((permission) => !remove.has(permission));
    });
  }

  return (
    <form action={action} className='space-y-6'>
      {mode === 'edit' && values.roleId ? (
        <input type='hidden' name='roleId' value={values.roleId} />
      ) : null}
      {selected.map((permission) => (
        <input
          key={permission}
          type='hidden'
          name='permissions'
          value={permission}
        />
      ))}

      <fieldset className='grid gap-5 rounded-xl border border-stroke bg-white p-6 md:grid-cols-2'>
        <legend className='px-2 text-lg font-semibold'>Rol</legend>

        <div className='space-y-1'>
          <Label htmlFor='name'>Nombre</Label>
          <Input
            id='name'
            name='name'
            defaultValue={values.name}
            required
            placeholder='ej. Soporte comercial'
            aria-invalid={Boolean(state.errors?.name)}
          />
          <FieldError message={state.errors?.name} />
        </div>

        <div className='space-y-1 md:col-span-2'>
          <Label htmlFor='description'>Descripción</Label>
          <Textarea
            id='description'
            name='description'
            defaultValue={values.description}
            placeholder='Breve descripción de qué puede hacer este rol'
            aria-invalid={Boolean(state.errors?.description)}
          />
          <FieldError message={state.errors?.description} />
        </div>
      </fieldset>

      <fieldset className='space-y-5 rounded-xl border border-stroke bg-white p-6'>
        <legend className='px-2 text-lg font-semibold'>Permisos</legend>
        <FieldError message={state.errors?.permissions} />

        {permissionGroups.map((group) => {
          const selectedInGroup = group.permissions.filter((permission) =>
            selected.includes(permission),
          );
          const allSelected =
            selectedInGroup.length === group.permissions.length;

          return (
            <section key={group.category} className='space-y-3'>
              <div className='flex items-center justify-between gap-3 border-b border-stroke pb-2'>
                <h3 className='text-sm font-semibold text-gray-900'>
                  {group.label}
                </h3>
                <label className='flex cursor-pointer items-center gap-2 text-xs text-gray-600'>
                  <span>Todos</span>
                  <Switch
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      toggleCategory(group.permissions, checked)
                    }
                  />
                </label>
              </div>
              <div className='grid gap-3 md:grid-cols-2'>
                {group.permissions.map((permission) => {
                  const checked = selected.includes(permission);
                  return (
                    <label
                      key={permission}
                      className='flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-stroke p-3 hover:bg-gray-50'
                    >
                      <span className='text-sm font-medium text-gray-900'>
                        {CONTROL_PERMISSION_LABELS[permission]}
                      </span>
                      <Switch
                        checked={checked}
                        onCheckedChange={(value) =>
                          togglePermission(permission, value)
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

      {state.errors?.general && (
        <p className='text-sm font-medium text-red-600'>
          {state.errors.general}
        </p>
      )}

      <Button type='submit' disabled={pending}>
        {pending
          ? 'Guardando...'
          : mode === 'create'
            ? 'Crear rol'
            : 'Guardar cambios'}
      </Button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className='text-sm font-medium text-red-600'>{message}</p>
  ) : null;
}
