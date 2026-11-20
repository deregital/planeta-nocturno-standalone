'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';

import {
  requestWithdrawalLink,
  type RequestLinkState,
} from '@/app/(client)/arrepentimiento/actions';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Button } from '@/components/ui/button';
import { WITHDRAWAL_LINK_TTL_HOURS } from '@/lib/withdrawal';

export function WithdrawalRequestForm({
  linkExpired,
  defaultValues,
}: {
  linkExpired: boolean;
  defaultValues: { mail: string; dni: string };
}) {
  const [state, formAction, pending] = useActionState<
    RequestLinkState,
    FormData
  >(requestWithdrawalLink, { status: 'idle', values: defaultValues });
  // Volver al formulario después de "Revisá tu mail" sin perder lo tipeado.
  const [editing, setEditing] = useState(false);

  if (state.status === 'sent' && !editing) {
    return (
      <section className='flex flex-col items-center gap-4 text-center'>
        <MailCheck className='size-12 text-accent' aria-hidden />
        <h1 className='text-3xl font-bold'>Revisá tu mail</h1>
        <p className='text-base'>
          Si hay compras con ese mail y DNI, te mandamos un link a{' '}
          <strong className='break-all'>{state.mail}</strong> para elegir la
          compra. Vence en {WITHDRAWAL_LINK_TTL_HOURS} horas.
        </p>
        <p className='text-sm text-accent-dark/70'>
          ¿No te llegó? Revisá el correo no deseado o{' '}
          <button
            type='button'
            className='cursor-pointer font-medium text-accent underline underline-offset-2'
            onClick={() => setEditing(true)}
          >
            probá con otros datos
          </button>
          .
        </p>
      </section>
    );
  }

  const values =
    state.status === 'sent'
      ? { mail: state.mail, dni: '' }
      : (state.values ?? defaultValues);
  const errors = state.status === 'error' ? state.errors : {};

  return (
    <>
      <header className='flex flex-col gap-2'>
        <h1 className='text-3xl font-bold'>Botón de arrepentimiento</h1>
        <p className='text-base'>
          Cancelá una compra dentro de los 10 días y hasta 24 horas antes del
          evento: te devolvemos todo, incluido el cargo por servicio.
        </p>
      </header>

      {linkExpired && (
        <p
          role='alert'
          className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900'
        >
          El link venció o no es válido. Pedí uno nuevo.
        </p>
      )}

      <form
        action={(formData) => {
          setEditing(false);
          formAction(formData);
        }}
        className='flex flex-col gap-4'
        noValidate
      >
        <InputWithLabel
          id='mail'
          name='mail'
          label='Mail con el que compraste'
          type='email'
          inputMode='email'
          autoComplete='email'
          required
          defaultValue={values.mail}
          error={errors.mail}
        />
        <InputWithLabel
          id='dni'
          name='dni'
          label='DNI'
          type='text'
          autoComplete='off'
          required
          defaultValue={values.dni}
          error={errors.dni}
        />
        {errors.form && (
          <p role='alert' className='text-sm text-red-500'>
            {errors.form}
          </p>
        )}
        <Button
          type='submit'
          variant='accent'
          className='w-full'
          loading={pending}
        >
          Continuar
        </Button>
        <p className='text-center text-sm text-accent-dark/70'>
          No hace falta tener una cuenta.
        </p>
      </form>

      <p className='text-xs text-accent-dark/70'>
        Es tu derecho de revocación (cláusula 8 de los{' '}
        <Link href='/terminos' className='underline underline-offset-2'>
          Términos y condiciones
        </Link>
        ).
      </p>
    </>
  );
}
