import 'server-only';

import { unstable_cache } from 'next/cache';

// Límites de PostHog: 240 consultas por minuto y 3 en paralelo por proyecto.
const CACHE_SECONDS = 300;

type HogQLResponse = {
  columns: string[];
  results: unknown[][];
};

function getConfig() {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const ingestHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !projectId || !ingestHost) return null;

  return {
    apiKey,
    projectId,
    // La API y la UI viven en us.posthog.com; us.i.posthog.com es sólo ingesta.
    appHost: ingestHost
      .replace(/\/$/, '')
      .replace('.i.posthog.com', '.posthog.com'),
  };
}

export function isPostHogQueryConfigured() {
  return getConfig() !== null;
}

/** URL de la UI de PostHog dentro del proyecto, p. ej. `/replay/<id>`. */
export function posthogProjectUrl(path: string) {
  const config = getConfig();
  return config ? `${config.appHost}/project/${config.projectId}${path}` : null;
}

async function runHogQLQuery(
  name: string,
  query: string,
  values: Record<string, string | number>,
) {
  const config = getConfig();
  if (!config) throw new Error('PostHog query API is not configured');

  const response = await fetch(
    `${config.appHost}/api/projects/${config.projectId}/query/`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: { kind: 'HogQLQuery', query, values },
        name,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `PostHog query "${name}" failed with ${response.status}: ${await response.text()}`,
    );
  }

  const data = (await response.json()) as HogQLResponse;
  return data.results.map((row) =>
    Object.fromEntries(data.columns.map((column, i) => [column, row[i]])),
  );
}

/**
 * Corre una consulta HogQL con caché de 5 minutos. Los valores van como
 * placeholders (`{nombre}` en la consulta), nunca interpolados.
 */
export const queryPostHog = unstable_cache(runHogQLQuery, ['posthog-hogql'], {
  revalidate: CACHE_SECONDS,
});
