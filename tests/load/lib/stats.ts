import { performance } from 'node:perf_hooks';

import superjson from 'superjson';

export function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}

export function summarize(values: number[]) {
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    n: values.length,
    p50: round(percentile(values, 50)),
    p95: round(percentile(values, 95)),
    p99: round(percentile(values, 99)),
    max: round(Math.max(0, ...values)),
  };
}

export async function timed<T>(fn: () => Promise<T>) {
  const start = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - start };
}

/** Tamaño del payload tal como lo serializa tRPC (superjson). */
export function payloadBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(superjson.serialize(value)));
}

/** Ejecuta `count` tareas con a lo sumo `concurrency` en vuelo. */
export async function runPool<T>(
  count: number,
  concurrency: number,
  task: (index: number) => Promise<T>,
) {
  const results: PromiseSettledResult<T>[] = new Array(count);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, count) }, () =>
    (async () => {
      while (next < count) {
        const index = next++;
        try {
          results[index] = { status: 'fulfilled', value: await task(index) };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
        }
      }
    })(),
  );
  await Promise.all(workers);
  return results;
}

export function errorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    const cause = (reason as { cause?: unknown }).cause;
    const causeMessage =
      cause instanceof Error
        ? cause.message
        : cause
          ? String(cause)
          : undefined;
    return causeMessage
      ? `${reason.message} ← ${causeMessage}`
      : reason.message;
  }
  return String(reason);
}

export function countBy<T>(items: T[], key: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}
