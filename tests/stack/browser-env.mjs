// Lo que comparten el navegador para agentes (browser.mjs) y los tests e2e
// (tests/e2e): cómo llega Chromium al stack, los celulares que se simulan y la
// cámara falsa del scanner.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STACK = path.dirname(fileURLToPath(import.meta.url));
export const RUN = path.join(STACK, '.run');

// up.sh anota en .run/https-port el puerto del frente HTTPS (443, o el siguiente
// libre si otro entorno lo ocupa).
export function httpsPort() {
  const file = path.join(RUN, 'https-port');
  const port = existsSync(file) ? Number(readFileSync(file, 'utf8').trim()) : 443;
  return Number.isFinite(port) && port > 0 ? port : 443;
}

// *.pn.test, *.mock.test y el bucket de S3 van al frente HTTPS local. Las URLs
// quedan sin puerto (como en producción) aunque el frente escuche en otro.
export function chromiumArgs(port = httpsPort()) {
  const hosts = ['*.pn.test', 'pn.test', '*.mock.test', 'planeta-nocturno.s3.us-east-1.amazonaws.com'];
  const rules = hosts.map((host) => `MAP ${host}:443 127.0.0.1:${port}`).join(', ');
  return [`--host-resolver-rules=${rules}`, '--ignore-certificate-errors'];
}

// Celular: Android con el viewport típico medido en PostHog (390–402 × ~720, con
// la barra del navegador). "instagram" suma el navegador interno de Instagram,
// por donde entra ~1 de cada 4 visitas desde el celular.
export function deviceOptions(devices, kind) {
  const phone = { ...devices['Pixel 7'], viewport: { width: 393, height: 727 } };
  if (kind === 'desktop') return { viewport: { width: 1366, height: 860 } };
  if (kind === 'instagram') {
    return {
      ...phone,
      userAgent: `${phone.userAgent} Instagram 350.0.0.30.97 Android (33/13; 420dpi; 1080x2400; Google; Pixel 7; panther; tensor; es_AR; 645370941)`,
    };
  }
  return phone;
}

export const CONTEXT_DEFAULTS = {
  ignoreHTTPSErrors: true,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Buenos_Aires',
};

// Ruido propio del entorno local (no existe fuera de Vercel): no se reporta.
export const IGNORED = [/\/_vercel\/(insights|speed-insights)\//, /Refused to execute script from .*\/_vercel\//];
export const ignored = (text) => IGNORED.some((re) => re.test(text));

// Reemplaza getUserMedia por un canvas que muestra la imagen pedida con
// window.__fakeCam.show(dataUrl): el scanner lee QR reales.
export const FAKE_CAMERA = `(() => {
  if (window.__fakeCam || !navigator.mediaDevices) return;
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 720;
  const ctx = canvas.getContext('2d');
  let image = null; let zoom = 1; let frame = 0;
  const draw = () => {
    frame += 1;
    ctx.fillStyle = frame % 2 ? '#202020' : '#212121';
    ctx.fillRect(0, 0, 720, 720);
    if (image) {
      const scale = Math.min(720 / image.width, 720 / image.height) * zoom;
      const w = image.width * scale; const h = image.height * scale;
      ctx.drawImage(image, (720 - w) / 2, (720 - h) / 2, w, h);
    }
  };
  setInterval(draw, 33);
  window.__fakeCam = {
    show(dataUrl, z) { const i = new Image(); i.onload = () => { image = i; zoom = z || 1; }; i.src = dataUrl; },
    blank() { image = null; },
  };
  const original = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (constraints && constraints.video) return canvas.captureStream(30);
    return original(constraints);
  };
  navigator.mediaDevices.enumerateDevices = async () => [
    { deviceId: 'fake-camera', groupId: 'fake', kind: 'videoinput', label: 'Cámara de prueba', toJSON() { return this; } },
  ];
})();`;
