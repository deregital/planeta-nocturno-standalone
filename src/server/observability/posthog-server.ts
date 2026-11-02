import 'server-only';

import { PostHog } from 'posthog-node';

const globalForPostHog = globalThis as typeof globalThis & {
  __posthogServer?: PostHog | null;
};

/** Cliente de PostHog del servidor: excepciones y eventos como `purchase_completed`. */
export function getPostHogServer() {
  if (globalForPostHog.__posthogServer === undefined) {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!token || !host) {
      if (process.env.NODE_ENV !== 'production') {
        for (const variable of [
          !token && 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN',
          !host && 'NEXT_PUBLIC_POSTHOG_HOST',
        ].filter(Boolean)) {
          console.error(
            `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`,
          );
        }
      }

      globalForPostHog.__posthogServer = null;
    } else {
      globalForPostHog.__posthogServer = new PostHog(token, {
        host,
        flushAt: 1,
        flushInterval: 0,
        enableExceptionAutocapture: true,
      });
    }
  }

  return globalForPostHog.__posthogServer;
}
