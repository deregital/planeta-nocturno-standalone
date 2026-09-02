import { isValidPhoneNumber } from 'libphonenumber-js';
import z from 'zod';

export const phoneNumberSchema = z
  .string()
  .transform((value) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return '';

    const internationalValue = trimmedValue.startsWith('+')
      ? trimmedValue
      : `+54${trimmedValue.replace(/\D/g, '').replace(/^0/, '')}`;

    return internationalValue.startsWith('+5415')
      ? internationalValue.replace(/^\+5415/, '+5411')
      : internationalValue;
  })
  .refine((value) => !value || isValidPhoneNumber(value), {
    message: 'El teléfono no es válido',
  });

export const genderSchema = z.enum(['male', 'female', 'other'], {
  error: 'Seleccione un género válido',
});
