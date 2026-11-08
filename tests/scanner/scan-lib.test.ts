/**
 * Módulos compartidos del escáner: lectura del QR de siempre en el celular,
 * hash de la tabla, regla de decisión y textos. Corre con:
 *   npm run test:scanner
 */
import '@tests/load/bootstrap';

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  decideKnownTicket,
  isSelfRepeat,
  SELF_REPEAT_WINDOW_MS,
  selfRepeatAttemptAt,
} from '@/lib/scan/decision';
import {
  decryptLegacyQr,
  importLegacyQrKey,
  isLegacyQrFormat,
} from '@/lib/scan/legacy-qr';
import {
  clampMaxStaleSeconds,
  combineConfigs,
  dniTail,
  minMode,
} from '@/lib/scan/protocol';
import {
  classifyRequestError,
  isUnexpectedScanError,
  NETWORK_RETRY_MS,
  OFFLINE_GRACE_MS,
  SCAN_TIMEOUT_MS,
  ScanRequestError,
  scanErrorTexts,
  sendWithGrace,
  type ScanErrorCode,
} from '@/lib/scan/scan-errors';
import {
  type LastRead,
  markSeen,
  SAME_CODE_WINDOW_MS,
  scanSound,
  shouldEvaluateRead,
  STILL_IN_VIEW_MS,
} from '@/lib/scan/read-gate';
import { successScanTexts } from '@/lib/scan/scan-texts';
import { STOP_TONES, tonesWav } from '@/lib/scan/tones';
import { ticketHash } from '@/lib/scan/ticket-hash';
import {
  getLegacyQrKeyBase64,
  serverTicketHash,
} from '@/server/utils/scanner-crypto';
import { decryptString, encryptString } from '@/server/utils/utils';

// Se lee al cifrar, no al importar.
process.env.BARCODE_SECRET ??= 'scanner-test-secret';

describe('QR de siempre leído en el celular', () => {
  it('descifra exactamente lo que cifra el servidor', async () => {
    const key = await importLegacyQrKey(getLegacyQrKeyBase64());
    for (let i = 0; i < 300; i++) {
      const id = randomUUID();
      const code = encryptString(id);
      assert.ok(isLegacyQrFormat(code), `formato no reconocido: ${code}`);
      assert.equal(await decryptLegacyQr(code, key), id);
      assert.equal(decryptString(code), id);
    }
  });

  it('con otra clave no lee el QR (y no inventa un id)', async () => {
    const other = await importLegacyQrKey(randomBytes(32).toString('base64'));
    for (let i = 0; i < 100; i++) {
      assert.equal(
        await decryptLegacyQr(encryptString(randomUUID()), other),
        null,
      );
    }
  });

  it('rechaza lo que no tiene el formato', async () => {
    const key = await importLegacyQrKey(getLegacyQrKeyBase64());
    for (const code of [
      '',
      'qr-invalido',
      'https://example.com/ticket/123',
      encryptString(randomUUID()) + ':extra',
      ' ' + encryptString(randomUUID()),
      'AAAAAAAAAAAAAAAAAAAAAA==:AAAA',
    ]) {
      assert.equal(await decryptLegacyQr(code, key), null, code);
    }
  });

  it('la clave tiene 32 bytes', async () => {
    await assert.rejects(importLegacyQrKey(randomBytes(16).toString('base64')));
  });
});

describe('hash de la tabla', () => {
  it('celular y servidor calculan el mismo hash', async () => {
    for (let i = 0; i < 200; i++) {
      const id = randomUUID();
      const hash = await ticketHash(id);
      assert.equal(hash, serverTicketHash(id));
      assert.equal(hash.length, 22);
      assert.equal(await ticketHash(id.toUpperCase()), hash);
    }
  });
});

describe('decisión sobre una entrada conocida', () => {
  it('entrada sin escanear: entra', () => {
    assert.deepEqual(
      decideKnownTicket({ scanned: false, scanCount: 0 }, false),
      {
        status: 'success',
        scanNumber: 1,
      },
    );
  });

  it('ya escaneada: rebota salvo multiescaneo', () => {
    assert.deepEqual(
      decideKnownTicket({ scanned: true, scanCount: 1 }, false),
      {
        status: 'already-scanned',
      },
    );
    assert.deepEqual(decideKnownTicket({ scanned: true, scanCount: 2 }, true), {
      status: 'success',
      scanNumber: 3,
    });
  });
});

describe('reescaneo propio', () => {
  const now = Date.parse('2026-11-09T03:00:00Z');

  it('mismo celular, registro dentro de la ventana', () => {
    assert.ok(
      isSelfRepeat({
        scannedByMe: true,
        serverScannedAt: new Date(now - 8_000).toISOString(),
        firstAttemptAt: now - 10_000,
        now,
      }),
    );
  });

  it('no alcanza con el mismo usuario', () => {
    assert.ok(
      !isSelfRepeat({
        scannedByMe: true,
        serverScannedAt: new Date(now - 8_000).toISOString(),
        firstAttemptAt: undefined,
        now,
      }),
    );
  });

  it('otro usuario, registro viejo o intento viejo: no es propio', () => {
    const base = {
      scannedByMe: true,
      serverScannedAt: new Date(now - 8_000).toISOString(),
      firstAttemptAt: now - 10_000,
      now,
    };
    assert.ok(!isSelfRepeat({ ...base, scannedByMe: false }));
    assert.ok(
      !isSelfRepeat({
        ...base,
        serverScannedAt: new Date(now - 3_600_000).toISOString(),
      }),
    );
    assert.ok(
      !isSelfRepeat({
        ...base,
        firstAttemptAt: now - SELF_REPEAT_WINDOW_MS - 1,
      }),
    );
  });

  it('cuenta solo un intento anterior que no mostró decisión', () => {
    // Pedido sin respuesta (ámbar) o todavía en vuelo: el "ya escaneado" puede
    // ser ese mismo pedido.
    assert.equal(
      selfRepeatAttemptAt({ at: now - 20_000, outcome: 'error' }, now),
      now - 20_000,
    );
    assert.equal(
      selfRepeatAttemptAt({ at: now - 2_000, outcome: 'pending' }, now),
      now - 2_000,
    );
    // La puerta ya vio el verde (o "Ya registrado"): otra lectura del mismo
    // QR es otra presentación, por ejemplo una captura pasada a otra persona.
    for (const outcome of [
      'success',
      'self-repeat',
      'already-scanned',
      'not-found',
    ]) {
      assert.equal(
        selfRepeatAttemptAt({ at: now - 20_000, outcome }, now),
        undefined,
        outcome,
      );
    }
    assert.equal(
      selfRepeatAttemptAt(
        { at: now - SELF_REPEAT_WINDOW_MS - 1, outcome: 'error' },
        now,
      ),
      undefined,
    );
    assert.equal(selfRepeatAttemptAt(undefined, now), undefined);
  });
});

describe('textos', () => {
  it('éxito con aviso de horario en hora de Argentina', () => {
    const texts = successScanTexts({
      fullName: 'Ana Pérez',
      startingDate: '2026-11-10T03:00:00.000Z',
      scanLimit: null,
      scanNumber: 2,
      invitedBy: 'Juan',
      now: new Date('2026-11-09T03:00:00.000Z'),
    });
    assert.equal(texts.text, 'Escaneado con éxito: Ana Pérez');
    assert.equal(
      texts.extraInfo,
      'La hora de inicio del ticket es a las 10/11/2026 00:00 - Escaneo #2 - Invitado por Juan',
    );
  });

  it('éxito simple sin extras', () => {
    const texts = successScanTexts({
      fullName: 'Ana',
      startingDate: null,
      scanLimit: null,
      scanNumber: 1,
      invitedBy: null,
    });
    assert.equal(texts.extraInfo, '');
  });
});

describe('configuración', () => {
  it('manda el modo y el N más conservador', () => {
    assert.equal(minMode('local', 'shadow'), 'shadow');
    assert.equal(minMode('off', 'local'), 'off');
    assert.deepEqual(
      combineConfigs([
        { mode: 'local', maxStaleSeconds: 60 },
        { mode: 'shadow', maxStaleSeconds: 120 },
      ]),
      { mode: 'shadow', maxStaleSeconds: 60 },
    );
    assert.deepEqual(combineConfigs([]), { mode: 'off', maxStaleSeconds: 60 });
  });

  it('acota N', () => {
    assert.equal(clampMaxStaleSeconds(1), 10);
    assert.equal(clampMaxStaleSeconds(10_000), 300);
    assert.equal(clampMaxStaleSeconds(Number.NaN), 60);
  });

  it('DNI: solo los últimos dígitos', () => {
    assert.equal(dniTail('40.123.456'), '456');
    assert.equal(dniTail('AB12'), '12');
  });
});

describe('errores de escaneo', () => {
  const trpcError = (code: string, httpStatus: number, message = 'motivo') =>
    Object.assign(new Error(message), {
      name: 'TRPCClientError',
      data: { code, httpStatus },
    });
  const online = { online: true };

  it('clasifica por red, sesión, permisos y servidor', () => {
    assert.equal(
      classifyRequestError(new Error('x'), { online: false }).code,
      'OFFLINE',
    );
    const noResponse = Object.assign(new Error('Failed to fetch'), {
      name: 'TRPCClientError',
    });
    assert.equal(classifyRequestError(noResponse, online).code, 'NETWORK');
    assert.equal(
      classifyRequestError(new TypeError('Failed to fetch'), online).code,
      'NETWORK',
    );
    assert.equal(
      classifyRequestError(trpcError('UNAUTHORIZED', 401), online).code,
      'SESSION_EXPIRED',
    );
    assert.deepEqual(
      classifyRequestError(trpcError('FORBIDDEN', 403, 'Sin acceso'), online),
      { code: 'FORBIDDEN', serverMessage: 'Sin acceso' },
    );
    assert.equal(
      classifyRequestError(
        trpcError('INTERNAL_SERVER_ERROR', 500, 'Failed query: insert'),
        online,
      ).code,
      'SERVER',
    );
    assert.deepEqual(
      classifyRequestError(
        trpcError('PRECONDITION_FAILED', 412, 'Falta actualizar'),
        online,
      ),
      { code: 'REJECTED', serverMessage: 'Falta actualizar' },
    );
    assert.equal(classifyRequestError(new Error('?'), online).code, 'UNKNOWN');
    const already = new ScanRequestError('OFFLINE', {
      fallbackReason: 'unknown',
    });
    assert.equal(classifyRequestError(already, online).code, 'OFFLINE');
  });

  it('los textos dicen qué pasó, que no se registró y qué hacer, sin SQL ni inglés', () => {
    const codes: ScanErrorCode[] = [
      'OFFLINE',
      'NETWORK',
      'SESSION_EXPIRED',
      'FORBIDDEN',
      'SERVER',
      'REJECTED',
      'UNKNOWN',
    ];
    for (const code of codes) {
      const texts = scanErrorTexts(code, {
        serverMessage: code === 'SERVER' ? 'Failed query: insert' : undefined,
      });
      assert.ok(texts.text.length > 0, code);
      assert.match(texts.extraInfo, /no se registró/i, code);
      assert.doesNotMatch(texts.extraInfo, /failed|fetch|query/i, code);
    }
    assert.match(
      scanErrorTexts('OFFLINE', { fallbackReason: 'unknown' }).extraInfo,
      /no está en la lista del celular/,
    );
    assert.match(
      scanErrorTexts('REJECTED', { serverMessage: 'Falta actualizar la base.' })
        .extraInfo,
      /^Falta actualizar la base\./,
    );
  });

  it('sin respuesta a tiempo: no afirma que no se registró', () => {
    const texts = scanErrorTexts('TIMEOUT');
    assert.match(texts.text, /no respondió a tiempo/);
    assert.match(texts.extraInfo, /No se sabe si se registró/);
    assert.match(texts.extraInfo, /volvé a escanearla/);
    assert.doesNotMatch(texts.extraInfo, /La entrada no se registró/);
  });

  it('solo lo inesperado va a Error Tracking', () => {
    assert.equal(isUnexpectedScanError('SERVER'), true);
    assert.equal(isUnexpectedScanError('UNKNOWN'), true);
    assert.equal(isUnexpectedScanError('OFFLINE'), false);
    assert.equal(isUnexpectedScanError('NETWORK'), false);
    assert.equal(isUnexpectedScanError('TIMEOUT'), false);
    assert.equal(isUnexpectedScanError('SESSION_EXPIRED'), false);
  });
});

describe('microcortes (sendWithGrace)', () => {
  /** Red y reloj simulados: `offlineUntil` es cuándo vuelve la red. */
  function network({ offlineUntil = 0 } = {}) {
    let now = 1_000_000;
    const state = {
      offlineUntil: now + offlineUntil,
      waiting: [] as boolean[],
    };
    return {
      state,
      deps: {
        now: () => now,
        isOnline: () => now >= state.offlineUntil,
        sleep: async (ms: number) => {
          now += ms;
        },
        waitForOnline: async (deadline: number) => {
          if (now >= state.offlineUntil) return true;
          if (state.offlineUntil < deadline) {
            now = state.offlineUntil;
            return true;
          }
          now = deadline;
          return false;
        },
        onWaiting: (waiting: boolean) => state.waiting.push(waiting),
      },
    };
  }
  const networkError = () =>
    Object.assign(new Error('Failed to fetch'), { name: 'TRPCClientError' });

  it('con red, un solo pedido y sin esperar', async () => {
    const { deps, state } = network();
    let calls = 0;
    const out = await sendWithGrace(async () => ++calls, deps);
    assert.deepEqual(out, { result: 1, retried: false });
    assert.deepEqual(state.waiting, [false]);
  });

  it('un microcorte de 3 s: espera y lo manda cuando vuelve', async () => {
    const { deps, state } = network({ offlineUntil: 3_000 });
    let calls = 0;
    const out = await sendWithGrace(async () => ++calls, deps);
    assert.equal(out.result, 1);
    // Esperar antes del primer envío no es un reintento: nada había salido.
    assert.equal(out.retried, false);
    assert.deepEqual(state.waiting, [true, false]);
  });

  it('falla por red, se corta la red y vuelve: es un reintento', async () => {
    const { deps, state } = network();
    let calls = 0;
    const out = await sendWithGrace(async () => {
      calls += 1;
      if (calls === 1) {
        state.offlineUntil = deps.now() + 2_000;
        throw networkError();
      }
      return 'ok';
    }, deps);
    assert.deepEqual(out, { result: 'ok', retried: true });
  });

  it('un pedido colgado se corta por tiempo: TIMEOUT, sin reintento', async () => {
    const { deps } = network();
    const timer = { fire: null as (() => void) | null, ms: -1 };
    let calls = 0;
    const pending = sendWithGrace(
      (signal) => {
        calls += 1;
        // Como fetch: no responde nunca, salvo que lo corten.
        return new Promise((_, reject) => {
          signal.addEventListener('abort', () =>
            reject(
              Object.assign(new Error('aborted'), { name: 'TRPCClientError' }),
            ),
          );
        });
      },
      {
        ...deps,
        schedule: (run, ms) => {
          timer.fire = run;
          timer.ms = ms;
          return () => {};
        },
      },
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(timer.ms, SCAN_TIMEOUT_MS);
    assert.ok(timer.fire, 'no programó el corte');
    timer.fire();
    await assert.rejects(
      pending,
      (error) => error instanceof ScanRequestError && error.code === 'TIMEOUT',
    );
    assert.equal(calls, 1);
  });

  it('el corte por tiempo se cancela cuando responde', async () => {
    const { deps } = network();
    let cancelled = 0;
    const out = await sendWithGrace(async () => 'ok', {
      ...deps,
      schedule: () => () => {
        cancelled += 1;
      },
    });
    assert.equal(out.result, 'ok');
    assert.equal(cancelled, 1);
  });

  it(`más de ${OFFLINE_GRACE_MS / 1000} s sin red: error OFFLINE, sin pedido`, async () => {
    const { deps } = network({ offlineUntil: OFFLINE_GRACE_MS + 5_000 });
    let calls = 0;
    await assert.rejects(
      sendWithGrace(async () => ++calls, {
        ...deps,
        fallbackReason: 'unknown',
      }),
      (error) => {
        assert.ok(error instanceof ScanRequestError);
        assert.equal(error.code, 'OFFLINE');
        assert.equal(error.fallbackReason, 'unknown');
        return true;
      },
    );
    assert.equal(calls, 0);
  });

  it('el pedido falla por red: reintenta y entra', async () => {
    const { deps } = network();
    let calls = 0;
    const out = await sendWithGrace(async () => {
      calls += 1;
      if (calls < 3) throw networkError();
      return 'ok';
    }, deps);
    assert.deepEqual(out, { result: 'ok', retried: true });
    assert.equal(calls, 3);
  });

  it('si la red sigue fallando, corta al pasar el margen con NETWORK', async () => {
    const { deps } = network();
    let calls = 0;
    await assert.rejects(
      sendWithGrace(async () => {
        calls += 1;
        throw networkError();
      }, deps),
      (error) => error instanceof ScanRequestError && error.code === 'NETWORK',
    );
    assert.ok(calls <= OFFLINE_GRACE_MS / NETWORK_RETRY_MS);
    assert.ok(calls > 1);
  });

  it('un rechazo o error del servidor no se reintenta', async () => {
    const { deps } = network();
    for (const [code, httpStatus, expected] of [
      ['INTERNAL_SERVER_ERROR', 500, 'SERVER'],
      ['FORBIDDEN', 403, 'FORBIDDEN'],
      ['UNAUTHORIZED', 401, 'SESSION_EXPIRED'],
    ] as const) {
      let calls = 0;
      await assert.rejects(
        sendWithGrace(async () => {
          calls += 1;
          throw Object.assign(new Error('x'), {
            name: 'TRPCClientError',
            data: { code, httpStatus },
          });
        }, deps),
        (error) => error instanceof ScanRequestError && error.code === expected,
      );
      assert.equal(calls, 1, code);
    }
  });
});

describe('lector: QR quieto y pasamanos', () => {
  const QR = 'qr-de-sofia';
  /** Simula la cámara: el QR se detecta cada 500 ms mientras está enfrente. */
  function camera(outcome: string) {
    let now = 0;
    let last: LastRead | null = null;
    const evaluations: number[] = [];
    const see = (code = QR) => {
      if (shouldEvaluateRead(last, code, now)) {
        evaluations.push(now);
        last = { code, respondedAt: now, seenAt: now, outcome };
      } else {
        markSeen(last, code, now);
      }
    };
    return {
      evaluations,
      see,
      /** El QR queda frente a la cámara `ms`. */
      hold(ms: number) {
        for (let t = 0; t < ms; t += 500) {
          see();
          now += 500;
        }
      },
      away(ms: number) {
        now += ms;
      },
    };
  }

  it('Sofía entra y se queda con el QR frente a la cámara: no se reevalúa', () => {
    const cam = camera('success');
    cam.hold(15_000);
    assert.deepEqual(cam.evaluations, [0]);
  });

  it('el QR sale de cuadro y vuelve (captura a Martina): se reevalúa', () => {
    const cam = camera('success');
    cam.hold(3_000);
    cam.away(30_000);
    cam.hold(1_000);
    assert.equal(cam.evaluations.length, 2);
  });

  it('un corte de detección de más de 2 s cuenta como otra presentación', () => {
    const cam = camera('success');
    cam.hold(6_000);
    cam.away(STILL_IN_VIEW_MS + 500);
    cam.hold(1_000);
    assert.equal(cam.evaluations.length, 2);
  });

  it('dentro de los primeros 5 s nunca se repite, aunque salga y vuelva', () => {
    const cam = camera('success');
    cam.hold(1_000);
    cam.away(2_500);
    cam.hold(1_000);
    assert.equal(cam.evaluations.length, 1);
  });

  it('después de un rechazo o un error, quieto se vuelve a evaluar cada 5 s', () => {
    for (const outcome of ['already-scanned', 'error', 'not-found']) {
      const cam = camera(outcome);
      cam.hold(SAME_CODE_WINDOW_MS * 2 + 1_000);
      assert.equal(cam.evaluations.length, 3, outcome);
    }
  });

  it('otro QR se evalúa enseguida', () => {
    const cam = camera('success');
    cam.hold(1_000);
    cam.see('qr-de-otra-persona');
    assert.equal(cam.evaluations.length, 2);
  });
});

describe('sonido por resultado', () => {
  it('pasa: un pip; no pasa (rechazo, otro evento o sin decisión): tres', () => {
    assert.equal(scanSound('success'), 'let-in');
    assert.equal(scanSound('self-repeat'), 'let-in');
    for (const status of [
      'already-scanned',
      'not-found',
      'error',
      'server-error',
    ]) {
      assert.equal(scanSound(status), 'stop', status);
    }
  });

  it('el sonido de "no pasa" es un WAV válido de tres pips', () => {
    const wav = tonesWav(STOP_TONES);
    const view = new DataView(wav.buffer);
    assert.equal(String.fromCharCode(...wav.subarray(0, 4)), 'RIFF');
    assert.equal(String.fromCharCode(...wav.subarray(8, 12)), 'WAVE');
    const sampleRate = view.getUint32(24, true);
    const seconds = view.getUint32(40, true) / 2 / sampleRate;
    assert.ok(seconds > 0.45 && seconds < 0.6, `dura ${seconds} s`);
    assert.equal(STOP_TONES.filter((tone) => 'hz' in tone).length, 3);
  });
});
