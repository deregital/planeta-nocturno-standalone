import * as XLSX from 'xlsx';
import { z } from 'zod';

import { userSchema } from '@/server/schemas/user';

// Schema para validar usuarios del Excel (sin género, username, password, role)
const excelUserSchema = userSchema
  .omit({ gender: true, name: true, password: true, role: true })
  .extend({
    // Mapear los campos del Excel a los campos del schema
    fullName: z.string().min(1, {
      error: 'El nombre completo es requerido',
    }),
  });

export interface ImportUserData {
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  fechaNacimiento: string;
  telefono: string;
}

export interface ValidationError {
  rowNumber: number;
  message: string;
}

export interface ParseResult {
  users: ImportUserData[];
  errors: ValidationError[];
}

/**
 * Normaliza el número de teléfono agregando código de país si es necesario
 */
const normalizePhoneNumber = (phoneValue: unknown): string => {
  if (!phoneValue) return '';

  const phone = String(phoneValue).trim().replace(/\s/g, '');

  // Si ya tiene código de país, devolverlo tal como está
  if (phone.startsWith('+549')) {
    return phone;
  }

  // Si empieza con 11 o 15, agregar +549
  if (phone.startsWith('11') || phone.startsWith('15')) {
    return `+549${phone}`;
  }

  // Si empieza con 9 (sin el 54), agregar +549
  if (phone.startsWith('9')) {
    return `+549${phone}`;
  }

  // Para otros casos, devolver tal como está
  return phone;
};

/**
 * Convierte diferentes formatos de fecha a YYYY-MM-DD
 */
const normalizeDate = (dateValue: unknown): string => {
  if (!dateValue) return '';

  let date: Date;

  // Si es un número (serial de Excel)
  if (typeof dateValue === 'number') {
    // Excel serial date: días desde 1900-01-01
    const excelEpoch = new Date(1900, 0, 1);
    date = new Date(
      excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000,
    );
  }
  // Si es un objeto Date
  else if (dateValue instanceof Date) {
    date = dateValue;
  }
  // Si es una string
  else {
    const dateStr = String(dateValue).trim();

    // Intentar diferentes formatos
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{1}\/\d{1}\/\d{4}$/, // M/D/YYYY
      /^\d{2}\/\d{1}\/\d{4}$/, // MM/D/YYYY
      /^\d{1}\/\d{2}\/\d{4}$/, // M/DD/YYYY
      /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    ];

    let matchedFormat = false;
    for (const format of formats) {
      if (format.test(dateStr)) {
        matchedFormat = true;
        break;
      }
    }

    if (!matchedFormat) {
      throw new Error(`Formato de fecha no reconocido: ${dateStr}`);
    }

    date = new Date(dateStr);
  }

  if (isNaN(date.getTime())) {
    throw new Error(`Fecha inválida: ${dateValue}`);
  }

  // Convertir a formato YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const parseExcelFile = (file: File): Promise<ImportUserData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Validar que tenga las columnas correctas
        const headers = jsonData[0] as unknown as string[];
        if (!headers || headers.length < 6) {
          reject(new Error('El archivo debe tener al menos 6 columnas'));
          return;
        }

        const users: ImportUserData[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown as string[];
          if (row && row.length >= 6) {
            try {
              const normalizedDate = normalizeDate(row[4]);
              const normalizedPhone = normalizePhoneNumber(row[5]);
              users.push({
                nombre: String(row[0] || '').trim(),
                apellido: String(row[1] || '').trim(),
                email: String(row[2] || '').trim(),
                dni: String(row[3] || '').trim(),
                fechaNacimiento: normalizedDate,
                telefono: normalizedPhone,
              });
            } catch {
              // Si hay error en la fecha, usar el valor original como string
              const normalizedPhone = normalizePhoneNumber(row[5]);
              users.push({
                nombre: String(row[0] || '').trim(),
                apellido: String(row[1] || '').trim(),
                email: String(row[2] || '').trim(),
                dni: String(row[3] || '').trim(),
                fechaNacimiento: String(row[4] || '').trim(),
                telefono: normalizedPhone,
              });
            }
          }
        }

        resolve(users);
      } catch {
        reject(new Error('Error al procesar el archivo Excel'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };

    reader.readAsArrayBuffer(file);
  });
};

const transformExcelDataToSchema = (user: ImportUserData) => {
  return {
    fullName: `${user.nombre} ${user.apellido}`.trim(),
    email: user.email,
    dni: user.dni,
    phoneNumber: user.telefono,
    birthDate: user.fechaNacimiento,
  };
};

export const validateUsers = (users: ImportUserData[]): ValidationError[] => {
  const errors: ValidationError[] = [];

  users.forEach((user, index) => {
    const rowNumber = index + 2; // +2 porque empezamos desde la fila 2 (después del header)

    try {
      const transformedData = transformExcelDataToSchema(user);

      excelUserSchema.parse(transformedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((zodError: z.core.$ZodIssue) => {
          errors.push({
            rowNumber,
            message: zodError.message,
          });
        });
      } else {
        errors.push({
          rowNumber,
          message: 'Error de validación inesperado',
        });
      }
    }
  });

  return errors;
};

/**
 * Valida que no existan duplicados dentro del archivo
 */
export const validateDuplicates = (
  users: ImportUserData[],
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const emails = new Set<string>();
  const dnis = new Set<string>();

  users.forEach((user, index) => {
    const rowNumber = index + 2;

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
  });

  return errors;
};

/**
 * Procesa completamente un archivo Excel: parsea y valida
 */
export const processExcelFile = async (file: File): Promise<ParseResult> => {
  try {
    const users = await parseExcelFile(file);

    if (users.length === 0) {
      return {
        users: [],
        errors: [
          {
            rowNumber: 0,
            message: 'No se encontraron usuarios válidos en el archivo',
          },
        ],
      };
    }

    // Validar datos básicos
    const validationErrors = validateUsers(users);

    // Validar duplicados
    const duplicateErrors = validateDuplicates(users);

    return {
      users,
      errors: [...validationErrors, ...duplicateErrors],
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
  const templateData = [
    [
      'Nombre',
      'Apellido',
      'Dirección de correo electrónico',
      'DNI',
      'Fecha nacimiento en formato YYYY-MM-DD',
      'Número de teléfono',
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios');

  XLSX.writeFile(workbook, 'template-usuarios.xlsx');
};
