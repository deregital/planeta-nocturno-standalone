/**
 * Sonidos cortos generados en el celular (WAV en memoria, sin bajar nada):
 * la puerta puede no tener conexión.
 */

export type Tone = { hz: number; ms: number } | { silenceMs: number };

const SAMPLE_RATE = 22_050;
/** Subida y bajada de cada pip, para que no haga "clic". */
const FADE_MS = 6;

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(binary);
}

/**
 * WAV mono de 16 bits. Onda cuadrada suavizada: se oye bien en el parlante
 * chico del celular y con ruido de fondo.
 */
export function tonesWav(tones: Tone[], volume = 0.5): Uint8Array {
  const samples: number[] = [];
  const fade = Math.round((FADE_MS / 1000) * SAMPLE_RATE);
  for (const tone of tones) {
    if ('silenceMs' in tone) {
      const n = Math.round((tone.silenceMs / 1000) * SAMPLE_RATE);
      for (let i = 0; i < n; i++) samples.push(0);
      continue;
    }
    const n = Math.round((tone.ms / 1000) * SAMPLE_RATE);
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const square = Math.tanh(4 * Math.sin(2 * Math.PI * tone.hz * t));
      const envelope = Math.min(1, i / fade, (n - 1 - i) / fade);
      samples.push(square * envelope * volume);
    }
  }

  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  samples.forEach((value, i) => {
    view.setInt16(44 + i * 2, Math.round(value * 0x7fff), true);
  });
  return new Uint8Array(buffer);
}

export function tonesDataUri(tones: Tone[], volume?: number) {
  return `data:audio/wav;base64,${toBase64(tonesWav(tones, volume))}`;
}

/** No pasa: tres pips cortos y graves. */
export const STOP_TONES: Tone[] = [
  { hz: 523, ms: 110 },
  { silenceMs: 70 },
  { hz: 523, ms: 110 },
  { silenceMs: 70 },
  { hz: 392, ms: 160 },
];
