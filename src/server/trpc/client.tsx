'use client';
// ^-- to make sure we can mount the Provider from a server component
import type { QueryClient } from '@tanstack/react-query';
import type { AppRouter } from '@/server/routers/app';

import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, httpLink, loggerLink, splitLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import superjson from 'superjson';

import { makeQueryClient } from '@/server/trpc/query-client';

export const trpc = createTRPCReact<AppRouter>();
let clientQueryClientSingleton: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  return (clientQueryClientSingleton ??= makeQueryClient());
}

function getUrl() {
  const base = (() => {
    if (typeof window !== 'undefined') return '';
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return 'http://localhost:3000';
  })();
  return `${base}/api/trpc`;
}
export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === 'development' ||
            (op.direction === 'down' &&
              op.result instanceof Error &&
              // Sin red, la sincronización del escáner falla cada pocos
              // segundos a propósito: no ensuciar la consola.
              // (el tipo de las respuestas no declara `path`, pero viene).
              !(op as { path?: string }).path?.startsWith('scanner.')),
        }),
        // La sincronización del escáner va sola: en un batch, un escaneo
        // esperaría a que termine una bajada lenta (y al revés).
        splitLink({
          condition: (op) => op.path.startsWith('scanner.'),
          true: httpLink({
            transformer: superjson,
            url: getUrl(),
            headers: () => {
              const headers = new Headers();
              headers.set('x-trpc-source', 'nextjs-react');
              return headers;
            },
          }),
          false: httpBatchLink({
            transformer: superjson,
            url: getUrl(),
            headers: () => {
              const headers = new Headers();
              headers.set('x-trpc-source', 'nextjs-react');
              return headers;
            },
          }),
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </trpc.Provider>
    </QueryClientProvider>
  );
}
