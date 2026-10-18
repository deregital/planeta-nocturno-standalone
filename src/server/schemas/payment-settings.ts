import z from 'zod';

export const transferAliasSchema = z
  .string()
  .trim()
  .regex(
    /^([a-zA-Z0-9.-]{6,20}|\d{22})$/,
    'Ingresá un alias válido (6 a 20 caracteres: letras, números, puntos o guiones) o un CBU/CVU de 22 dígitos',
  );
