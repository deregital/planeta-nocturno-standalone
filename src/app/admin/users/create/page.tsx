import { CreateUserForm } from '@/components/admin/users/CreateUserForm';

export default function CreateUserPage() {
  return (
    <div className='flex flex-col gap-4 p-4'>
      <h1 className='text-2xl font-bold'>Crear usuario</h1>
      <CreateUserForm />
    </div>
  );
}
