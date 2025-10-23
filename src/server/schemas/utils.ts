import { isValidPhoneNumber } from 'libphonenumber-js';
import z from 'zod';

export const phoneNumberSchema = z.string().refine(
  (value) => {
    // Allow empty string since the field is optional
    if (!value || value.trim() === '') {
      return true;
    }

    console.log('valueSchema', value);

    if (value.startsWith('+5415')) {
      const newNumber = value.replace(/^\+5415/, '+5411');
      return isValidPhoneNumber(newNumber);
    }

    return isValidPhoneNumber(value);
  },
  {
    message: 'El teléfono no es válido',
  },
);

export const genderSchema = z.enum(['male', 'female', 'other'], {
  error: 'Seleccione un género válido',
});
