import type { Metadata } from 'next';

import '@/app/globals.css';
import { Analytics } from '@vercel/analytics/next';
import { DM_Sans } from 'next/font/google';
import { headers } from 'next/headers';

import { InstanceProvider } from '@/components/instance/InstanceProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getMultiTenantLandingConfig } from '@/lib/config/multi-tenant-landing';
import { getColors } from '@/lib/get-colors';
import { ROOT_LANDING_HEADER } from '@/lib/tenancy/host';
import { isControlRequest } from '@/server/control/is-control-request';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { TRPCReactProvider } from '@/server/trpc/client';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = new Headers(await headers());

  if (requestHeaders.get(ROOT_LANDING_HEADER) === '1') {
    const landing = getMultiTenantLandingConfig();
    return { title: landing.name, description: landing.description };
  }

  if (isControlRequest(requestHeaders)) {
    return {
      title: 'Administración central',
      description: 'Gestión central de instancias y páginas',
    };
  }

  const { instance } = await getCurrentRequestContext();

  return {
    title: instance.name,
    description:
      instance.description ?? 'Plataforma de eventos y venta de entradas',
    icons: { icon: [{ url: instance.faviconUrl ?? '/icon.ico' }] },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = new Headers(await headers());
  const rootLandingRequest = requestHeaders.get(ROOT_LANDING_HEADER) === '1';
  const controlRequest =
    !rootLandingRequest && isControlRequest(requestHeaders);
  const instance =
    controlRequest || rootLandingRequest
      ? null
      : (await getCurrentRequestContext()).instance;
  const colors = getColors(instance?.hue ?? 200, instance?.saturation ?? 100);
  const colorVariables = {
    '--accent-dark-color': colors.accentDark,
    '--accent-color': colors.accentColor,
    '--button-color': colors.buttonColor,
    '--brand-color': colors.brandColor,
    '--accent-light-color': colors.accentLight,
    '--accent-ultra-light-color': colors.accentUltraLight,
    '--on-accent-color': colors.textOnAccent,
    '--stroke-color': colors.accentColor,
  } as React.CSSProperties;

  return (
    <html
      lang='es'
      className='notranslate'
      translate='no'
      style={colorVariables}
    >
      <body className={`${dmSans.className} antialiased`}>
        {instance ? (
          <InstanceProvider
            instance={{
              name: instance.name,
              faviconUrl: instance.faviconUrl,
              publicUrl: instance.publicUrl,
              siteUrl: instance.siteUrl,
              hue: instance.hue,
              saturation: instance.saturation,
            }}
          >
            <TRPCReactProvider>
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster />
              <Analytics />
            </TRPCReactProvider>
          </InstanceProvider>
        ) : (
          <>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
            <Analytics />
          </>
        )}
      </body>
    </html>
  );
}
