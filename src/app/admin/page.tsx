import { signOut } from '@/server/auth';

export default function Admin() {
  return (
    <form
      className='flex justify-center items-center h-screen'
      action={async () => {
        'use server';
        await signOut();
      }}
    >
      <button
        className='bg-red-500 text-white p-2 rounded-md cursor-pointer'
        type='submit'
      >
        Logout
      </button>
    </form>
  );
}
