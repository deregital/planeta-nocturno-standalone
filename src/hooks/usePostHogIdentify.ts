'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';

import {
  personDisplayName,
  readInstanceContext,
  tenantLabel,
} from '@/lib/analytics/instance-context';

const INSTANCE_GROUP_TYPE = 'instance';

type AnalyticsUser = {
  id: string;
  email: string | null | undefined;
  name: string | null | undefined;
  role: string;
};

/**
 * Identifica al usuario logueado en PostHog y lo asocia al grupo de su
 * instancia. Sólo se agrupa a usuarios identificados: con
 * `person_profiles: 'identified_only'`, `posthog.group` crearía perfiles para
 * todos los compradores anónimos.
 */
export function usePostHogIdentify(user: AnalyticsUser | null | undefined) {
  const id = user?.id;
  const email = user?.email;
  const name = user?.name;
  const role = user?.role;

  useEffect(() => {
    if (!id) return;

    const instance = readInstanceContext(document.documentElement);

    if (posthog._isIdentified() && posthog.get_distinct_id() !== id) {
      posthog.reset();
    }

    posthog.identify(id, {
      // PostHog muestra `name` si se pone primero en
      // Settings → Product analytics → Person display name.
      name: personDisplayName(name, instance),
      full_name: name,
      email,
      role,
      app_area: instance.area,
      instance_key: instance.key,
      instance_name: tenantLabel(instance),
    });

    if (
      instance.key &&
      posthog.getGroups()[INSTANCE_GROUP_TYPE] !== instance.key
    ) {
      posthog.group(INSTANCE_GROUP_TYPE, instance.key, {
        name: tenantLabel(instance),
        mode: instance.mode,
      });
    }
  }, [id, email, name, role]);
}

/** Llamar al cerrar sesión para no atribuir eventos al usuario anterior. */
export function resetPostHogUser() {
  posthog.reset();
}
