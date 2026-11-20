import { LEGAL_UPDATED_AT } from '@/lib/legal';

export function LegalDocument({
  title,
  intro,
  children,
}: {
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className='mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 text-accent-dark sm:py-12'>
      <header className='flex flex-col gap-3'>
        <h1 className='text-3xl font-bold'>{title}</h1>
        <p className='text-sm text-accent-dark/70'>
          Última actualización: {LEGAL_UPDATED_AT}
        </p>
        <div className='text-base leading-relaxed'>{intro}</div>
      </header>
      {children}
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className='flex flex-col gap-3 text-base leading-relaxed'>
      <h2 className='text-xl font-semibold'>{title}</h2>
      {children}
    </section>
  );
}

/** Cláusula numerada (1.1., 1.2.) o inciso con letra (a), b)) si `sub`. */
export function Clause({
  n,
  sub = false,
  children,
}: {
  n: string;
  sub?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p className={sub ? 'flex gap-2 pl-6' : 'flex gap-2'}>
      <span className='shrink-0 font-semibold tabular-nums'>{n}</span>
      <span className='min-w-0'>{children}</span>
    </p>
  );
}

/** Mail para reclamos y pedidos sobre los datos, o una indicación si falta. */
export function LegalContact({ email }: { email: string | null }) {
  if (!email) return <>los canales de contacto que figuran en este sitio</>;
  return (
    <a href={`mailto:${email}`} className='font-medium underline break-words'>
      {email}
    </a>
  );
}
