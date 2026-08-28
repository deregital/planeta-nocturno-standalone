import {
  CalendarDays,
  CreditCard,
  Mail,
  QrCode,
  Ticket,
  TicketCheck,
} from 'lucide-react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { getMultiTenantLandingConfig } from '@/lib/config/multi-tenant-landing';
import { ROOT_LANDING_HEADER } from '@/lib/tenancy/host';

const features = [
  {
    icon: CalendarDays,
    title: 'Gestión de eventos',
    description:
      'Organizá fechas, ubicaciones, cupos, tipos de entrada y equipos de trabajo.',
  },
  {
    icon: TicketCheck,
    title: 'Venta de entradas',
    description:
      'Publicá cada evento y ofrecé una compra simple desde cualquier dispositivo.',
  },
  {
    icon: CreditCard,
    title: 'Cobros directos',
    description:
      'Conectá Mercado Pago y recibí el dinero de tus ventas directamente en tu cuenta.',
  },
  {
    icon: QrCode,
    title: 'Control de acceso',
    description:
      'Validá entradas con código QR y consultá los ingresos desde el mismo sistema.',
  },
] as const;

export default async function MultiTenantLandingPage() {
  if ((await headers()).get(ROOT_LANDING_HEADER) !== '1') notFound();

  const landing = getMultiTenantLandingConfig();

  return (
    <main className='overflow-hidden bg-slate-50 text-slate-950'>
      <section className='relative flex min-h-[70svh] items-center justify-center px-6 py-20'>
        <div
          aria-hidden='true'
          className='absolute -top-32 -right-32 size-80 rounded-full opacity-10 blur-3xl'
          style={{ backgroundColor: landing.color }}
        />
        <div
          aria-hidden='true'
          className='absolute -bottom-40 -left-32 size-96 rounded-full opacity-10 blur-3xl'
          style={{ backgroundColor: landing.color }}
        />

        <div className='relative mx-auto flex max-w-3xl flex-col items-center text-center'>
          <div
            className='mb-8 flex size-16 items-center justify-center rounded-2xl border shadow-sm'
            style={{
              color: landing.color,
              borderColor: `${landing.color}40`,
              backgroundColor: `${landing.color}14`,
            }}
          >
            <Ticket aria-hidden='true' className='size-8' />
          </div>

          <h1 className='text-5xl font-bold tracking-tight sm:text-7xl'>
            {landing.name}
          </h1>
          <p className='mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl'>
            {landing.description}
          </p>

          <a
            href='#funciones'
            className='mt-10 rounded-full border px-6 py-3 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-80'
            style={{
              borderColor: `${landing.color}40`,
              backgroundColor: `${landing.color}14`,
            }}
          >
            Conocé la plataforma
          </a>
        </div>
      </section>

      <section
        id='funciones'
        aria-labelledby='features-title'
        className='border-y border-slate-200 bg-white px-6 py-20'
      >
        <div className='mx-auto max-w-6xl'>
          <div className='mx-auto max-w-2xl text-center'>
            <p className='text-sm font-semibold tracking-wide text-slate-500 uppercase'>
              Todo en un solo lugar
            </p>
            <h2
              id='features-title'
              className='mt-3 text-3xl font-bold tracking-tight sm:text-4xl'
            >
              Las herramientas para gestionar tus eventos
            </h2>
          </div>

          <div className='mt-12 grid gap-5 sm:grid-cols-2'>
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className='rounded-2xl border border-slate-200 bg-slate-50 p-6'
                >
                  <div
                    className='flex size-11 items-center justify-center rounded-xl'
                    style={{
                      color: landing.color,
                      backgroundColor: `${landing.color}14`,
                    }}
                  >
                    <Icon aria-hidden='true' className='size-5' />
                  </div>
                  <h3 className='mt-5 text-lg font-semibold'>
                    {feature.title}
                  </h3>
                  <p className='mt-2 leading-7 text-slate-600'>
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        aria-labelledby='contact-title'
        className='bg-slate-950 px-6 py-20 text-white'
      >
        <div className='mx-auto max-w-3xl text-center'>
          <h2 id='contact-title' className='text-3xl font-bold tracking-tight'>
            ¿Querés saber más?
          </h2>
          <p className='mx-auto mt-4 max-w-xl leading-7 text-slate-300'>
            Escribinos para conocer cómo la plataforma puede acompañar tus
            próximos eventos.
          </p>
          <a
            href={`mailto:${landing.contactEmail}`}
            className='mt-8 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-700 px-5 py-3 font-medium transition-colors hover:bg-white hover:text-slate-950'
          >
            <Mail aria-hidden='true' className='size-4 shrink-0' />
            <span className='break-all'>{landing.contactEmail}</span>
          </a>
        </div>
      </section>

      <footer className='bg-slate-950 px-6 pb-8 text-center text-sm text-slate-500'>
        <p>
          © {new Date().getFullYear()} {landing.name}
        </p>
      </footer>
    </main>
  );
}
