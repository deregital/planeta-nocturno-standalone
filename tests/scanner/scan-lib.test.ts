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
