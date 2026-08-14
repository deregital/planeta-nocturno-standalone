import type { Metadata } from 'next';

import '@/app/globals.css';
import { Analytics } from '@vercel/analytics/next';
import { DM_Sans } from 'next/font/google';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getSingleTenantConfig } from '@/server/config/single-tenant-config';
import { TRPCReactProvider } from '@/server/trpc/client';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_INSTANCE_NAME?.trim() || 'Planeta Nocturno',
  description:
    process.env.NEXT_PUBLIC_INSTANCE_DESCRIPTION?.trim() ||
    'Plataforma multi-tenant de Planeta Nocturno',
  icons: {
    icon: [
      {
        url: process.env.NEXT_PUBLIC_FAVICON_URL?.trim() || '/icon.ico',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const singleTenantConfig = getSingleTenantConfig();

  if (!singleTenantConfig) {
    console.info(
      '[Planeta Nocturno] Instancia multi-tenant en modo de prueba. El aprovisionamiento y las migraciones de tenants están deshabilitados.',
    );

    return (
      <html lang='es' className='notranslate' translate='no'>
        <body className={`${dmSans.className} antialiased`}>
          <main className='flex min-h-screen items-center justify-center p-6'>
            <div className='max-w-xl text-center'>
              <p className='mb-2 text-sm font-medium uppercase'>
                Planeta Nocturno
              </p>
              <h1 className='text-3xl font-bold'>Instancia multi-tenant</h1>
              <p className='mt-4 text-base text-gray-600'>
                Modo de prueba activo. El aprovisionamiento de tenants todavía
                no crea bases de datos ni ejecuta migraciones.
              </p>
            </div>
          </main>
          <Analytics />
        </body>
      </html>
    );
  }

  return (
    <TRPCReactProvider>
      <html lang='es' className='notranslate' translate='no'>
        <body className={`${dmSans.className} antialiased`}>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
          <Analytics />
        </body>
      </html>
    </TRPCReactProvider>
  );
}
