'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useActionState, useState } from 'react';

import {
  type ControlAdminFormState,
  type ControlAdminFormValues,
  createControlAdmin,
  updateControlAdmin,
} from '@/app/control/(protected)/users/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatRoleName } from '@/lib/control/role-name';

type RoleOption = { id: string; name: string; description: string | null };

export default function ControlAdminForm({
  mode,
  roles,
  initialValues,
}: {
  mode: 'create' | 'edit';
  roles: RoleOption[];
  initialValues?: ControlAdminFormValues;
}) {
  const actionFn = mode === 'create' ? createControlAdmin : updateControlAdmin;
  const [state, action, pending] = useActionState<
    ControlAdminFormState,
    FormData
  >(actionFn, {});
  const values = {
    username: '',
    email: '',
    password: '',
    roleId: roles[0]?.id ?? '',
    ...initialValues,
    ...state.values,
  };
  const [roleId, setRoleId] = useState(values.roleId);

  return (
    <form action={action} className='space-y-6'>
      {mode === 'edit' && values.adminId ? (
        <input type='hidden' name='adminId' value={values.adminId} />
      ) : null}
      <input type='hidden' name='roleId' value={roleId} />

      <fieldset className='grid gap-5 rounded-xl border border-stroke bg-white p-6 md:grid-cols-2'>
        <legend className='px-2 text-lg font-semibold'>Datos de acceso</legend>

        <FormField
          label='Usuario'
          name='username'
          defaultValue={values.username}
          error={state.errors?.username}
          required
        />
        <FormField
          label='Email'
          name='email'
          type='email'
          defaultValue={values.email}
          error={state.errors?.email}
          required
        />
        <FormField
          label={mode === 'create' ? 'Contraseña' : 'Nueva contraseña'}
          name='password'
          type='password'
          defaultValue=''
          error={state.errors?.password}
          placeholder={
            mode === 'create'
              ? 'Mínimo 4 caracteres'
              : 'Dejar vacío para no cambiar'
          }
          required={mode === 'create'}
          hint={
            mode === 'edit'
              ? 'Dejá vacío para mantener la contraseña actual'
              : undefined
          }
        />
        <div className='space-y-1'>
          <Label htmlFor='roleId'>Rol</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger id='roleId' className='w-full'>
              <SelectValue placeholder='Elegí un rol' />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {formatRoleName(role.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={state.errors?.roleId} />
        </div>
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
            ? 'Crear usuario'
            : 'Guardar cambios'}
      </Button>
    </form>
  );
}

function FormField({
  label,
  name,
  defaultValue,
  error,
  type = 'text',
  required,
  hint,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  error?: string;
  type?: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className='space-y-1'>
      <Label htmlFor={name}>{label}</Label>
      <div className='relative'>
        <Input
          id={name}
          name={name}
          type={isPassword && showPassword ? 'text' : type}
          defaultValue={defaultValue}
          required={required}
          placeholder={placeholder}
          className={isPassword ? 'pr-10' : undefined}
          aria-invalid={Boolean(error)}
        />
        {isPassword && (
          <button
            type='button'
            onClick={() => setShowPassword((visible) => !visible)}
            className='absolute top-1/2 right-2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
            aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        )}
      </div>
      {hint && <p className='text-xs text-gray-500'>{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className='text-sm font-medium text-red-600'>{message}</p>
  ) : null;
}
