'use client';

import { Pencil } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';

import { updateTenantCustomId } from '@/app/control/(protected)/tenants/actions';
import { Input } from '@/components/ui/input';

export default function EditableCustomIdCell({
  tenantId,
  customId,
}: {
  tenantId: number;
  customId: string | null;
}) {
  const savedValue = customId ?? '';
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateTenantCustomId, {});
  const skipSubmitRef = useRef(false);

  useEffect(() => {
    setEditing(false);
  }, [savedValue]);

  if (!editing) {
    return (
      <div className='flex min-w-0 items-center gap-1.5'>
        <span className='font-medium'>{customId ?? '—'}</span>
        <button
          type='button'
          onClick={() => setEditing(true)}
          className='cursor-pointer inline-flex shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-accent'
          aria-label='Editar ID personalizable'
        >
          <Pencil className='size-3.5' />
        </button>
      </div>
    );
  }

  return (
    <form action={action} className='min-w-0'>
      <input type='hidden' name='tenantId' value={tenantId} />
      <Input
        autoFocus
        name='customId'
        defaultValue={savedValue}
        inputMode='numeric'
        pattern='[0-9]*'
        disabled={pending}
        placeholder='—'
        className='h-8 w-28 font-medium'
        aria-invalid={Boolean(state.error)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={(event) => {
          if (skipSubmitRef.current) {
            skipSubmitRef.current = false;
            setEditing(false);
            return;
          }
          if (event.currentTarget.value.trim() !== savedValue) {
            event.currentTarget.form?.requestSubmit();
            return;
          }
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            skipSubmitRef.current = true;
            event.currentTarget.value = savedValue;
            event.currentTarget.blur();
          }
        }}
      />
      {state.error && (
        <p className='mt-1 max-w-28 text-xs font-medium text-red-600'>
          {state.error}
        </p>
      )}
    </form>
  );
}
