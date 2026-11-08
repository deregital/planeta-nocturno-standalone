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
  ScanRequestError,
  scanErrorTexts,
  sendWithGrace,
  type ScanErrorCode,
} from '@/lib/scan/scan-errors';
import { successScanTexts } from '@/lib/scan/scan-texts';
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

  it('solo lo inesperado va a Error Tracking', () => {
    assert.equal(isUnexpectedScanError('SERVER'), true);
    assert.equal(isUnexpectedScanError('UNKNOWN'), true);
    assert.equal(isUnexpectedScanError('OFFLINE'), false);
    assert.equal(isUnexpectedScanError('NETWORK'), false);
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
    assert.equal(out.retried, true);
    assert.deepEqual(state.waiting, [true, false]);
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
