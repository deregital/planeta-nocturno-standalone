import { type ScannerMode } from '@/lib/scan/protocol';

/**
 * Datos de este celular guardados en el navegador. Si el almacenamiento no
 * está disponible (modo privado, bloqueado) todo cae a los valores por
 * defecto: el escáner funciona como siempre.
 */
const DEVICE_ID_KEY = 'pn-scanner-device-id';
const DEVICE_PREFS_KEY = 'pn-scanner-device-prefs';

/** `auto`: lo que diga el evento. Los otros solo pueden bajar el modo. */
export type DeviceModePreference = 'auto' | 'shadow' | 'off';

export type DevicePrefs = {
  mode: DeviceModePreference;
  /** Tope de N para este celular (null: el del evento). */
  maxStaleSeconds: number | null;
};

export const DEFAULT_DEVICE_PREFS: DevicePrefs = {
  mode: 'auto',
  maxStaleSeconds: null,
};

function safeGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: la preferencia dura lo que la pestaña.
  }
}

let memoryDeviceId: string | null = null;

export function getDeviceId(): string {
  const stored = safeGet(DEVICE_ID_KEY);
  if (stored) return stored;
  memoryDeviceId ??= crypto.randomUUID();
  safeSet(DEVICE_ID_KEY, memoryDeviceId);
  return memoryDeviceId;
}

/** Código corto para identificar el celular a la vista ("Terminal 7F3A"). */
export function deviceCode(deviceId: string) {
  return deviceId.replace(/-/g, '').slice(0, 4).toUpperCase();
}

export function readDevicePrefs(): DevicePrefs {
  const raw = safeGet(DEVICE_PREFS_KEY);
  if (!raw) return DEFAULT_DEVICE_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<DevicePrefs>;
    return {
      mode:
        parsed.mode === 'shadow' || parsed.mode === 'off'
          ? parsed.mode
          : 'auto',
      maxStaleSeconds:
        typeof parsed.maxStaleSeconds === 'number'
          ? parsed.maxStaleSeconds
          : null,
    };
  } catch {
    return DEFAULT_DEVICE_PREFS;
  }
}

export function writeDevicePrefs(prefs: DevicePrefs) {
  safeSet(DEVICE_PREFS_KEY, JSON.stringify(prefs));
}

export function deviceModeCap(preference: DeviceModePreference): ScannerMode {
  return preference === 'auto' ? 'local' : preference;
}
