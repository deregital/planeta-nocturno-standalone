import 'server-only';

import { type AnyValue, SeverityNumber } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
import { headers } from 'next/headers';
import { after } from 'next/server';

import { TENANT_ID_HEADER } from '@/lib/tenancy/host';
import { getSingleTenantConfig } from '@/server/config/single-tenant-config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogAttributes = Record<string, unknown>;
type HeaderReader = (name: string) => string | null | undefined;

const SEVERITY: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

// Headers que posthog-js agrega a los fetch del mismo host (`tracing_headers`).
// Permiten vincular cada log con la persona y el session replay del navegador.
const POSTHOG_SESSION_HEADER = 'x-posthog-session-id';
const POSTHOG_DISTINCT_ID_HEADER = 'x-posthog-distinct-id';

// Un único provider por proceso: Next compila instrumentation, middleware y
// rutas en bundles separados, así que un singleton de módulo se duplicaría.
const globalForLogs = globalThis as typeof globalThis & {
  __posthogLoggerProvider?: LoggerProvider | null;
};

const pendingRecords = new Set<Promise<void>>();

export function getLoggerProvider() {
  if (globalForLogs.__posthogLoggerProvider === undefined) {
    globalForLogs.__posthogLoggerProvider = createLoggerProvider();
  }

  return globalForLogs.__posthogLoggerProvider;
}

function createLoggerProvider() {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  if (!host || !token) {
    console.warn(
      '[logger] NEXT_PUBLIC_POSTHOG_HOST o NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN no están configuradas: los logs sólo se escriben en consola.',
    );
    return null;
  }

  return new LoggerProvider({
    resource: resourceFromAttributes({
      'service.name': 'planeta-nocturno-standalone',
      'service.version':
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      'deployment.environment.name':
        process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${host.replace(/\/$/, '')}/i/v1/logs`,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      }),
    ],
  });
}

/**
 * Atributos de instancia y de sesión de PostHog a partir de los headers del
 * request. El header de tenant lo setea el middleware después de validar el
 * host, así que es confiable.
 */
export function requestLogAttributes(readHeader: HeaderReader): LogAttributes {
  const singleTenantConfig = safeSingleTenantConfig();

  return {
    instance_mode: singleTenantConfig ? 'single-tenant' : 'multi-tenant',
    instance_key: singleTenantConfig
      ? new URL(singleTenantConfig.siteUrl).hostname
      : (readHeader(TENANT_ID_HEADER) ?? undefined),
    sessionId: readHeader(POSTHOG_SESSION_HEADER) ?? undefined,
    posthogDistinctId: readHeader(POSTHOG_DISTINCT_ID_HEADER) ?? undefined,
  };
}

async function currentRequestAttributes(): Promise<LogAttributes> {
  try {
    const requestHeaders = await headers();
    return requestLogAttributes((name) => requestHeaders.get(name));
  } catch {
    // Fuera de un request (scripts, build, middleware): sólo el modo de instancia.
    return requestLogAttributes(() => undefined);
  }
}

function safeSingleTenantConfig() {
  try {
    return getSingleTenantConfig();
  } catch {
    return null;
  }
}

function toLogAttributes(attributes: LogAttributes) {
  const result: Record<string, AnyValue> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) continue;

    if (value instanceof Error) {
      const prefix = key === 'error' ? 'exception' : `${key}.exception`;
      result[`${prefix}.type`] = value.name;
      result[`${prefix}.message`] = value.message;
      if (value.stack) result[`${prefix}.stacktrace`] = value.stack;
      continue;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] = value;
      continue;
    }

    if (value instanceof Date) {
      result[key] = value.toISOString();
      continue;
    }

    try {
      result[key] = JSON.stringify(value, (_, nested) =>
        typeof nested === 'bigint' ? nested.toString() : nested,
      );
    } catch {
      result[key] = String(value);
    }
  }

  return result;
}

async function emitRecord(
  provider: LoggerProvider,
  level: LogLevel,
  message: string,
  attributes: LogAttributes,
) {
  const requestAttributes = await currentRequestAttributes();

  provider.getLogger('app').emit({
    body: message,
    severityNumber: SEVERITY[level],
    severityText: level.toUpperCase(),
    attributes: {
      ...toLogAttributes(requestAttributes),
      ...toLogAttributes(attributes),
    },
  });
}

export async function flushLogs() {
  await Promise.allSettled([...pendingRecords]);
  await getLoggerProvider()?.forceFlush();
}

function scheduleFlush() {
  try {
    // En serverless el proceso puede congelarse al responder: `after` mantiene
    // la función viva hasta que el batch se envía.
    after(flushLogs);
  } catch {
    // Fuera de un request el BatchLogRecordProcessor exporta por su cuenta.
  }
}

/** Exporta a PostHog sin escribir en consola. */
export function exportLog(
  level: LogLevel,
  message: string,
  attributes: LogAttributes = {},
) {
  const provider = getLoggerProvider();
  if (!provider) return;

  const record = emitRecord(provider, level, message, attributes)
    .catch(() => {})
    .finally(() => pendingRecords.delete(record));
  pendingRecords.add(record);
  scheduleFlush();
}

function log(level: LogLevel, message: string, attributes: LogAttributes = {}) {
  const consoleMethod = level === 'debug' ? 'log' : level;
  if (Object.keys(attributes).length > 0) {
    console[consoleMethod](message, attributes);
  } else {
    console[consoleMethod](message);
  }

  exportLog(level, message, attributes);
}

/**
 * Logger del servidor. Escribe en consola (logs de Vercel) y exporta a PostHog
 * Logs con el tenant y la sesión del request. Un `Error` pasado en `error` se
 * guarda como `exception.type`, `exception.message` y `exception.stacktrace`.
 */
export const logger = {
  debug: (message: string, attributes?: LogAttributes) =>
    log('debug', message, attributes),
  info: (message: string, attributes?: LogAttributes) =>
    log('info', message, attributes),
  warn: (message: string, attributes?: LogAttributes) =>
    log('warn', message, attributes),
  error: (message: string, attributes?: LogAttributes) =>
    log('error', message, attributes),
};
