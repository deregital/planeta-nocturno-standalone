'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';

import {
  personDisplayName,
  readInstanceContext,
  tenantLabel,
} from '@/lib/analytics/instance-context';

const INSTANCE_GROUP_TYPE = 'instance';

// Firma (id + propiedades) del último identify enviado desde este navegador.
const SENT_IDENTITY_KEY = 'ph_sent_identity';

function readSentIdentity() {
  try {
    return localStorage.getItem(SENT_IDENTITY_KEY);
  } catch {
    return null;
  }
}

function rememberSentIdentity(signature: string) {
  try {
    localStorage.setItem(SENT_IDENTITY_KEY, signature);
  } catch {
    // Sin storage se vuelve a identificar en la próxima carga; no es grave.
  }
}

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

    const properties = {
      // PostHog muestra `name` si se pone primero en
      // Settings → Product analytics → Person display name.
      name: personDisplayName(name, instance),
      full_name: name,
      email,
      role,
      app_area: instance.area,
      instance_key: instance.key,
      instance_name: tenantLabel(instance),
    };

    // Ya identificado como este usuario, `identify` manda un `$set` en cada
    // carga de página aunque nada cambie (era ~4% del volumen de eventos).
    const signature = JSON.stringify([id, properties]);
    const alreadyIdentified =
      posthog._isIdentified() && posthog.get_distinct_id() === id;
    if (!alreadyIdentified || readSentIdentity() !== signature) {
      posthog.identify(id, properties);
      rememberSentIdentity(signature);
    }

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
