import { type CreateUserActionState } from '@/app/admin/users/create/actions';
import InputWithLabel from '@/components/common/InputWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { Button } from '@/components/ui/button';
import { role } from '@/drizzle/schema';
import { roleTranslation } from '@/lib/translations';

export function UserForm({
  userId,
  state,
  errors,
  handleSubmit,
  isPending,
}: {
  type: 'CREATE' | 'EDIT';
  userId?: string;
  state: CreateUserActionState['data'];
  errors: CreateUserActionState['errors'];
  handleSubmit: (formData: FormData) => void;
  isPending: boolean;
}) {
  return (
    <form action={handleSubmit} className='flex flex-col gap-4'>
      {userId && <input type='hidden' name='id' value={userId} />}
      <InputWithLabel
        required
        label='Nombre'
        id='fullName'
        name='fullName'
        defaultValue={state?.fullName}
        error={errors?.fullName}
      />
      <InputWithLabel
        required
        label='Nombre de usuario'
        id='username'
        name='username'
        defaultValue={state?.name}
        error={errors?.name}
      />
      <InputWithLabel
        label='Email'
        required
        id='email'
        name='email'
        type='email'
        defaultValue={state?.email}
        error={errors?.email}
      />
      <SelectWithLabel
        label='Rol'
        required
        id='role'
        name='role'
        defaultValue={state?.role}
        className='w-full'
        values={role.enumValues.map((roleValue) => ({
          label: roleTranslation[roleValue],
          value: roleValue,
        }))}
        error={errors?.role}
      />
      <InputWithLabel
        required
        label='Contraseña'
        id='password'
        name='password'
        defaultValue={state?.password}
        error={errors?.password}
      />
      {errors?.general && (
        <p className='pl-1 font-bold text-xs text-red-500'>{errors.general}</p>
      )}
      <Button type='submit' disabled={isPending}>
        Guardar
      </Button>
    </form>
  );
}
