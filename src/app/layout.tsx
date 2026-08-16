import type { Metadata } from 'next';

import '@/app/globals.css';
import { Analytics } from '@vercel/analytics/next';
import { DM_Sans } from 'next/font/google';

import { InstanceProvider } from '@/components/instance/InstanceProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getColors } from '@/lib/get-colors';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { TRPCReactProvider } from '@/server/trpc/client';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const { instance } = await getCurrentRequestContext();

  return {
    title: instance.name,
    description:
      instance.description ?? 'Plataforma multi-tenant de Planeta Nocturno',
    icons: { icon: [{ url: instance.faviconUrl ?? '/icon.ico' }] },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { instance } = await getCurrentRequestContext();
  const colors = getColors(instance.hue, instance.saturation);
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
        <InstanceProvider
          instance={{
            name: instance.name,
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
      </body>
    </html>
  );
}
