/**
 * Qué rutas de Pluto se atienden por el dominio raíz de una instancia
 * multi-tenant (el middleware deja pasar sólo éstas).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isPlutoInstanceApiPath } from '@/lib/pluto/instance-api';

describe('isPlutoInstanceApiPath', () => {
  it('acepta la agenda y las métricas, con o sin barra final', () => {
    assert.equal(isPlutoInstanceApiPath('/api/pluto/agenda'), true);
    assert.equal(isPlutoInstanceApiPath('/api/pluto/night-metrics/'), true);
  });

  it('rechaza el resto, incluido el calendario por productora', () => {
    assert.equal(isPlutoInstanceApiPath('/api/pluto/calendar-events'), false);
    assert.equal(isPlutoInstanceApiPath('/api/pluto'), false);
    assert.equal(isPlutoInstanceApiPath('/api/pluto/agenda/otra'), false);
    assert.equal(isPlutoInstanceApiPath('/'), false);
  });
});
