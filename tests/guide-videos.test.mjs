import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import ts from 'typescript';

const sourceUrl = new URL('../src/lib/guide.ts', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
const { getGuideVideosForPath } = await import(moduleUrl);

const videos = [
  createVideo('Crear evento', '/admin/event/create'),
  createVideo('Evento particular', '/admin/event/[slug]'),
];

test('prioriza la ruta exacta sobre una ruta dinámica', () => {
  assert.deepEqual(
    getGuideVideosForPath(videos, '/admin/event/create').map(
      (video) => video.title,
    ),
    ['Crear evento'],
  );
});

test('reconoce los segmentos dinámicos', () => {
  assert.deepEqual(
    getGuideVideosForPath(videos, '/admin/event/fiesta').map(
      (video) => video.title,
    ),
    ['Evento particular'],
  );
});

function createVideo(title, page) {
  return {
    title,
    video: { kind: 'embed', url: 'https://example.com/video' },
    pages: [page],
    role: { id: 'administrador', label: 'Administrador', slug: 'admin' },
  };
}
