import * as XLSX from 'xlsx';
import { z } from 'zod';

import {
  IMPORT_HEADERS,
  matchImportHeaders,
  parseImportGender,
  toIsoDateOnly,
  type ImportUserData,
} from '@/lib/userImportFormat';
import { userSchema } from '@/server/schemas/user';

export type { ImportUserData } from '@/lib/userImportFormat';

// Schema para validar usuarios del Excel (sin username, password, role)
const excelUserSchema = userSchema
  .pick({
    fullName: true,
    email: true,
    dni: true,
    gender: true,
    phoneNumber: true,
    instagram: true,
  })
  .extend({
    birthDate: z.iso
      .date({
        error:
          'La fecha de nacimiento no es válida. Use formato YYYY-MM-DD (ejemplo: 1990-12-31) o DD/MM/YYYY',
      })
      .min(new Date('1900-01-01').getTime(), {
        error: 'La fecha de nacimiento debe ser posterior al 01/01/1900',
      }),
  });

export interface ValidationError {
  rowNumber: number;
  message: string;
}

export interface ParseResult {
  users: ImportUserData[];
  errors: ValidationError[];
}

interface ParsedRow {
  rowNumber: number;
  user: ImportUserData;
  errors: string[];
}

const cellText = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value).trim();

/**
 * Normaliza el handle de Instagram removiendo @ si existe
 */
const normalizeInstagram = (instagramValue: unknown): string | undefined => {
  const instagram = cellText(instagramValue);
  if (!instagram) return undefined;
  return instagram.startsWith('@') ? instagram.slice(1) : instagram;
};

/**
 * Normaliza el número de teléfono agregando código de país si es necesario
 */
const normalizePhoneNumber = (phoneValue: unknown): string => {
  const phone = cellText(phoneValue).replace(/\s/g, '');
  if (!phone) return '';

  if (phone.startsWith('+')) return phone;

  // Si empieza con 11, 15 o 9 (sin el 54), agregar +549
  if (
    phone.startsWith('11') ||
    phone.startsWith('15') ||
    phone.startsWith('9')
  ) {
    return `+549${phone}`;
  }

  return phone;
};

/**
 * Convierte la fecha a YYYY-MM-DD. Acepta el serial de Excel, YYYY-MM-DD y
 * DD/MM/YYYY; si no la reconoce la devuelve tal cual y la validación avisa.
 */
const normalizeDate = (dateValue: unknown): string => {
  if (typeof dateValue === 'number') {
    const parsed = XLSX.SSF.parse_date_code(dateValue);
    if (!parsed) return String(dateValue);
    const month = String(parsed.m).padStart(2, '0');
    const day = String(parsed.d).padStart(2, '0');
    return `${parsed.y}-${month}-${day}`;
  }
  return toIsoDateOnly(cellText(dateValue));
};

const readRows = (file: File): Promise<unknown[][]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(
          XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
            header: 1,
            blankrows: false,
            defval: '',
          }),
        );
      } catch {
        reject(new Error('Error al procesar el archivo Excel'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };

    reader.readAsArrayBuffer(file);
  });

export const parseRows = (rows: unknown[][]): ParsedRow[] => {
  const [headers = [], ...dataRows] = rows;
  const match = matchImportHeaders(headers);
  if (!match.ok) {
    throw new Error(
      `Faltan columnas en el archivo: ${match.missing.join(', ')}. Descargá la plantilla o usá "Exportar para importación" desde un evento.`,
    );
  }

  const cell = (row: unknown[], key: keyof ImportUserData) => {
    const index = match.indexes[key];
    return index === undefined ? '' : row[index];
  };

  const parsed: ParsedRow[] = [];
  dataRows.forEach((row, index) => {
    // +2: la fila 1 es el encabezado y las filas de Excel arrancan en 1
    const rowNumber = index + 2;
    if (row.every((value) => cellText(value) === '')) return;

    const errors: string[] = [];
    const rawGender = cellText(cell(row, 'gender'));
    const gender = parseImportGender(rawGender);
    if (!gender) {
      errors.push(
        rawGender
          ? `El género "${rawGender}" no es válido. Use Masculino, Femenino u Otro`
          : 'El género es requerido (Masculino, Femenino u Otro)',
      );
    }

    parsed.push({
      rowNumber,
      errors,
      user: {
        fullName: cellText(cell(row, 'fullName')).replace(/\s+/g, ' '),
        email: cellText(cell(row, 'email')).toLowerCase(),
        dni: cellText(cell(row, 'dni')),
        gender: gender ?? 'other',
        birthDate: normalizeDate(cell(row, 'birthDate')),
        phoneNumber: normalizePhoneNumber(cell(row, 'phoneNumber')),
        instagram: normalizeInstagram(cell(row, 'instagram')),
      },
    });
  });

  return parsed;
};

export const validateRow = ({ user }: ParsedRow): string[] => {
  const result = excelUserSchema.safeParse({
    ...user,
    instagram: user.instagram ?? null,
  });
  if (result.success) return [];
  // El género ya se valida al leer la fila, con un mensaje más claro.
  return result.error.issues
    .filter((issue) => issue.path[0] !== 'gender')
    .map((issue) => issue.message);
};

/**
 * Valida que no existan duplicados dentro del archivo
 */
const validateDuplicates = (rows: ParsedRow[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  const emails = new Set<string>();
  const dnis = new Set<string>();

  for (const { rowNumber, user } of rows) {
    if (emails.has(user.email)) {
      errors.push({
        rowNumber,
        message: `El email ${user.email} está duplicado en el archivo`,
      });
    } else {
      emails.add(user.email);
    }

    if (dnis.has(user.dni)) {
      errors.push({
        rowNumber,
        message: `El DNI ${user.dni} está duplicado en el archivo`,
      });
    } else {
      dnis.add(user.dni);
    }
  }

  return errors;
};

/**
 * Procesa completamente un archivo Excel: parsea y valida
 */
export const processExcelFile = async (file: File): Promise<ParseResult> => {
  try {
    const rows = parseRows(await readRows(file));

    if (rows.length === 0) {
      return {
        users: [],
        errors: [
          {
            rowNumber: 0,
            message: 'No se encontraron usuarios en el archivo',
          },
        ],
      };
    }

    const rowErrors = rows.flatMap((row) =>
      [...row.errors, ...validateRow(row)].map((message) => ({
        rowNumber: row.rowNumber,
        message,
      })),
    );

    return {
      users: rows.map((row) => row.user),
      errors: [...rowErrors, ...validateDuplicates(rows)],
    };
  } catch (error) {
    return {
      users: [],
      errors: [
        {
          rowNumber: 0,
          message: error instanceof Error ? error.message : 'Error desconocido',
        },
      ],
    };
  }
};

/**
 * Genera un template Excel para descargar
 */
export const generateTemplate = (): void => {
  const worksheet = XLSX.utils.aoa_to_sheet([IMPORT_HEADERS]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios');

  XLSX.writeFile(workbook, 'template-usuarios.xlsx');
};
