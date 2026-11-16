import '@tests/load/bootstrap';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as XLSX from 'xlsx';

import { buildImportRows, IMPORT_HEADERS } from '@/lib/userImportFormat';
import { parseRows, validateRow } from '@/lib/userImportUtils';

const tickets = [
  {
    fullName: '  Juana   Pérez ',
    mail: 'Juana@Ejemplo.com',
    dni: '40123456',
    gender: 'female',
    birthDate: '1998-05-21',
    phoneNumber: '+5491123456789',
    instagram: 'juanaperez',
  },
  // Misma persona con otra entrada: el export la deja una sola vez.
  {
    fullName: 'Juana Pérez',
    mail: 'juana@ejemplo.com',
    dni: '40123456',
    gender: 'female',
    birthDate: '1998-05-21',
    phoneNumber: '+5491123456789',
    instagram: null,
  },
  {
    fullName: 'Lucas Gómez',
    mail: 'lucas@ejemplo.com',
    dni: '38999111',
    gender: 'male',
    birthDate: '03/11/1995',
    phoneNumber: '1155554444',
    instagram: null,
  },
];

const roundTrip = (aoa: unknown[][]) => {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const read = XLSX.read(new Uint8Array(out as ArrayBuffer), { type: 'array' });
  return XLSX.utils.sheet_to_json<unknown[]>(read.Sheets[read.SheetNames[0]], {
    header: 1,
    blankrows: false,
    defval: '',
  });
};

test('el export para importación se lee tal cual en la importación', () => {
  const rows = parseRows(
    roundTrip([IMPORT_HEADERS, ...buildImportRows(tickets)]),
  );

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.errors),
    [[], []],
  );
  assert.deepEqual(rows[0].user, {
    fullName: 'Juana Pérez',
    email: 'juana@ejemplo.com',
    dni: '40123456',
    gender: 'female',
    birthDate: '1998-05-21',
    phoneNumber: '+5491123456789',
    instagram: 'juanaperez',
  });
  assert.equal(rows[1].user.gender, 'male');
  assert.equal(rows[1].user.birthDate, '1995-11-03');
  assert.equal(rows[1].user.phoneNumber, '+5491155554444');
  assert.deepEqual(rows.map(validateRow), [[], []]);
});

test('las columnas se buscan por encabezado, en cualquier orden y con alias', () => {
  const rows = parseRows(
    roundTrip([
      [
        'Mail',
        'Género',
        'DNI/Pasaporte',
        'Nombre',
        'Teléfono',
        'Fecha de Nacimiento',
      ],
      [
        'ana@ejemplo.com',
        'Otro',
        '41000000',
        'Ana Ruiz',
        '1144443333',
        '1999-01-02',
      ],
    ]),
  );
  assert.equal(rows[0].user.fullName, 'Ana Ruiz');
  assert.equal(rows[0].user.gender, 'other');
  assert.equal(rows[0].user.instagram, undefined);
});

test('avisa las columnas que faltan y los géneros inválidos', () => {
  assert.throws(
    () => parseRows([['Nombre y apellido', 'Email']]),
    /Faltan columnas en el archivo: DNI, Género, Fecha de nacimiento, Teléfono/,
  );

  const [row] = parseRows([
    IMPORT_HEADERS,
    [
      'Ana Ruiz',
      'ana@ejemplo.com',
      '41000000',
      'Alien',
      '1999-01-02',
      '1144443333',
      '',
    ],
  ]);
  assert.match(row.errors[0], /El género "Alien" no es válido/);
});
