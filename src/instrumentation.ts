import { type Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const [{ getLoggerProvider }, { getPostHogErrorTracking }] =
    await Promise.all([
      import('@/server/observability/logger'),
      import('@/server/observability/posthog-error-tracking'),
    ]);
  getLoggerProvider();
  // Crear el cliente activa la captura de excepciones no manejadas: se crea
  // al arrancar y no recién con el primer error de request.
  getPostHogErrorTracking();
}

// Cualquier error no manejado del servidor (render, route handler, server
// action o middleware) termina en PostHog Logs y en Error Tracking con la
// ruta y el tenant.
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const [
    { exportLog, flushLogs, requestLogAttributes },
    { getPostHogErrorTracking },
  ] = await Promise.all([
    import('@/server/observability/logger'),
    import('@/server/observability/posthog-error-tracking'),
  ]);

  const readHeader = (name: string) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const requestAttributes = requestLogAttributes(readHeader);
  const digest =
    error instanceof Error && 'digest' in error ? error.digest : undefined;

  // Next ya imprime el error en consola: sólo se exporta a PostHog.
  exportLog('error', 'Unhandled request error', {
    ...requestAttributes,
    error,
    'error.digest': digest,
    'http.method': request.method,
    'http.path': request.path,
    'next.route': context.routePath,
    'next.route_type': context.routeType,
  });

  // Mismas propiedades que los eventos del navegador: el tenant para filtrar y
  // $session_id para vincular el error con el replay. error_digest es el mismo
  // que recibe error.tsx, así se cruzan ambos lados.
  const posthog = getPostHogErrorTracking();
  posthog?.captureException(error, readHeader('x-posthog-distinct-id'), {
    $session_id: readHeader('x-posthog-session-id'),
    instance_key: requestAttributes.instance_key,
    instance_mode: requestAttributes.instance_mode,
    error_digest: digest,
    next_route: context.routePath,
    next_route_type: context.routeType,
  });

  await Promise.all([flushLogs(), posthog?.flush()]);
};
