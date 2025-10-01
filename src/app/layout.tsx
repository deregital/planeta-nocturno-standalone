import type { Metadata } from 'next';

import { DM_Sans } from 'next/font/google';

import '@/app/globals.css';
import { Analytics } from '@vercel/analytics/next';

import { Toaster } from '@/components/ui/sonner';
import { TRPCReactProvider } from '@/server/trpc/client';
import { generateSlug } from '@/server/utils/utils';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_INSTANCE_NAME,
  description: process.env.NEXT_PUBLIC_INSTANCE_DESCRIPTION,
  icons: {
    icon: [
      {
        url: `${process.env.NEXT_PUBLIC_S3_BUCKET_URL!}/favicons/${generateSlug(process.env.NEXT_PUBLIC_INSTANCE_NAME!)}.png`,
        sizes: '32x32',
        type: 'image/png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TRPCReactProvider>
      <html lang='en'>
        <body className={`${dmSans.className} antialiased`}>
          {children}
          <Toaster />
          <Analytics />
        </body>
      </html>
    </TRPCReactProvider>
  );
}
