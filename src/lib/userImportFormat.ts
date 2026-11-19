import { tryDateOnlyToLocalDate } from '@/lib/date-only';

/**
 * Formato único del Excel de importación de organizadores. Lo usan la
 * plantilla, el export "para importación" de un evento y el import, así un
 * archivo exportado se puede arrastrar tal cual a la importación.
 */

export type ImportGender = 'male' | 'female' | 'other';

export interface ImportUserData {
  fullName: string;
  email: string;
  dni: string;
  gender: ImportGender;
  birthDate: string;
  phoneNumber: string;
  instagram?: string;
}

type ImportColumnKey = keyof ImportUserData;

interface ImportColumn {
  key: ImportColumnKey;
  header: string;
  required: boolean;
  /** Otros encabezados aceptados (exports viejos, planillas armadas a mano). */
  aliases: string[];
}

export const IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: 'fullName',
    header: 'Nombre y apellido',
    required: true,
    aliases: ['Nombre completo', 'Nombre', 'Apellido y nombre'],
  },
  {
    key: 'email',
    header: 'Email',
    required: true,
    aliases: [
      'Mail',
      'Correo',
      'Correo electrónico',
      'Dirección de correo electrónico',
    ],
  },
  {
    key: 'dni',
    header: 'DNI',
    required: true,
    aliases: ['DNI/Pasaporte', 'Pasaporte', 'Documento'],
  },
  {
    key: 'gender',
    header: 'Género',
    required: true,
    aliases: ['Genero', 'Sexo'],
  },
  {
    key: 'birthDate',
    header: 'Fecha de nacimiento',
    required: true,
    aliases: [
      'Fecha nacimiento',
      'Fecha nacimiento en formato YYYY-MM-DD',
      'Nacimiento',
    ],
  },
  {
    key: 'phoneNumber',
    header: 'Teléfono',
    required: true,
    aliases: ['Número de teléfono', 'Telefono', 'Celular'],
  },
  {
    key: 'instagram',
    header: 'Instagram (opcional)',
    required: false,
    aliases: ['Instagram'],
  },
];

export const IMPORT_HEADERS = IMPORT_COLUMNS.map((column) => column.header);

/** Minúsculas, sin acentos ni espacios repetidos. */
export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const headerLookup = new Map<string, ImportColumnKey>();
for (const column of IMPORT_COLUMNS) {
  for (const name of [column.header, ...column.aliases]) {
    headerLookup.set(normalizeHeader(name), column.key);
  }
}

export type HeaderMatch =
  | { ok: true; indexes: Partial<Record<ImportColumnKey, number>> }
  | { ok: false; missing: string[] };

/** Busca cada columna por su encabezado, sin importar el orden. */
export function matchImportHeaders(headers: unknown[]): HeaderMatch {
  const indexes: Partial<Record<ImportColumnKey, number>> = {};
  headers.forEach((header, index) => {
    const key = headerLookup.get(normalizeHeader(header));
    if (key && indexes[key] === undefined) indexes[key] = index;
  });

  const missing = IMPORT_COLUMNS.filter(
    (column) => column.required && indexes[column.key] === undefined,
  ).map((column) => column.header);

  return missing.length > 0 ? { ok: false, missing } : { ok: true, indexes };
}

const genderLookup = new Map<string, ImportGender>([
  ['male', 'male'],
  ['masculino', 'male'],
  ['hombre', 'male'],
  ['m', 'male'],
  ['female', 'female'],
  ['femenino', 'female'],
  ['mujer', 'female'],
  ['f', 'female'],
  ['other', 'other'],
  ['otro', 'other'],
  ['otra', 'other'],
  ['x', 'other'],
  ['no binario', 'other'],
]);

/** Acepta "Masculino"/"Femenino"/"Otro" o los valores internos. Null si no se reconoce. */
export function parseImportGender(value: unknown): ImportGender | null {
  return genderLookup.get(normalizeHeader(value)) ?? null;
}

// Igual que genderTranslation; no se importa de translations.tsx para no
// arrastrar componentes de React a este módulo (lo usa también el servidor).
const GENDER_LABELS: Record<ImportGender, string> = {
  male: 'Masculino',
  female: 'Femenino',
  other: 'Otro',
};

export function genderLabel(gender: string): string {
  return GENDER_LABELS[gender as ImportGender] ?? gender;
}

/** Fecha en YYYY-MM-DD, el formato que el import lee sin ambigüedad. */
export function toIsoDateOnly(value: string): string {
  const date = tryDateOnlyToLocalDate(value);
  if (!date) return value.trim();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface ImportRowSource {
  fullName: string;
  mail: string;
  dni: string;
  gender: string;
  birthDate: string;
  phoneNumber: string | null;
  instagram: string | null;
}

/**
 * Filas listas para el Excel de importación, una por persona: si alguien
 * tiene varias entradas (mismo DNI o mismo email) queda la primera.
 */
export function buildImportRows(sources: ImportRowSource[]): string[][] {
  const seenDnis = new Set<string>();
  const seenEmails = new Set<string>();
  const rows: string[][] = [];

  for (const source of sources) {
    const dni = source.dni.trim();
    const email = source.mail.trim().toLowerCase();
    if ((dni && seenDnis.has(dni)) || (email && seenEmails.has(email))) {
      continue;
    }
    if (dni) seenDnis.add(dni);
    if (email) seenEmails.add(email);

    rows.push([
      source.fullName.trim(),
      email,
      dni,
      genderLabel(source.gender),
      toIsoDateOnly(source.birthDate),
      source.phoneNumber?.trim() ?? '',
      source.instagram?.trim() ?? '',
    ]);
  }

  return rows;
}
