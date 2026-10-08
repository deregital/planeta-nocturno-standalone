import { type Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { getLoggerProvider } = await import('@/server/observability/logger');
  getLoggerProvider();
}

// Cualquier error no manejado del servidor (render, route handler, server
// action o middleware) termina en PostHog Logs con la ruta y el tenant.
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { exportLog, flushLogs, requestLogAttributes } = await import(
    '@/server/observability/logger'
  );

  const readHeader = (name: string) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  // Next ya imprime el error en consola: sólo se exporta a PostHog.
  exportLog('error', 'Unhandled request error', {
    ...requestLogAttributes(readHeader),
    error,
    'error.digest':
      error instanceof Error && 'digest' in error ? error.digest : undefined,
    'http.method': request.method,
    'http.path': request.path,
    'next.route': context.routePath,
    'next.route_type': context.routeType,
  });

  await flushLogs();
};
