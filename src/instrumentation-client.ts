import posthog from 'posthog-js';

import { POSTHOG_PROXY_PATH } from '@/lib/analytics/posthog-proxy';
import {
  anonymousDistinctId,
  readInstanceContext,
} from '@/lib/analytics/instance-context';

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (!token || !host) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[posthog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN o NEXT_PUBLIC_POSTHOG_HOST no están configuradas: no se envían eventos.',
    );
  }
} else {
  const instance = readInstanceContext(document.documentElement);
  // Se agregan en `before_send` y no con `register` para que no se persistan:
  // sobreviven a `posthog.reset()` y no se mezclan entre tenants.
  const instanceProperties = {
    app_area: instance.area,
    instance_mode: instance.mode,
    instance_key: instance.key,
    instance_name: instance.name,
  };

  posthog.init(token, {
    // Proxy propio (ver next.config.ts) para que los ad blockers no corten eventos.
    api_host: POSTHOG_PROXY_PATH,
    ui_host: host.replace('.i.posthog.com', '.posthog.com'),
    defaults: '2026-01-30',
    capture_exceptions: true,
    // Los anónimos no tienen perfil de persona: PostHog los muestra por su id.
    get_device_id: (uuid) => anonymousDistinctId(uuid, instance),
    // Cada subdominio es un tenant: no compartir identidad ni sesión entre ellos.
    cross_subdomain_cookie: false,
    // Vincula los logs del servidor con la persona y el replay de esta sesión.
    tracing_headers: [window.location.hostname],
    internal_or_test_user_hostname: /(^|\.)localhost$|^127\.0\.0\.1$/,
    // Session replay: los inputs se enmascaran por defecto. El texto con datos
    // personales necesita la clase `ph-mask` (o `ph-no-capture` para ocultarlo).
    before_send: (event) => {
      if (!event || event.event === '$snapshot') return event;
      event.properties = { ...event.properties, ...instanceProperties };
      return event;
    },
    debug: process.env.NODE_ENV === 'development',
  });
}
