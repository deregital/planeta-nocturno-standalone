import { type z, ZodBoolean, ZodNull, ZodNumber, ZodString } from 'zod';

import { Input } from '@/components/ui/input';

interface InputFromSchemaProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  field: z.ZodType;
}

export function InputFromSchema({ field, ...props }: InputFromSchemaProps) {
  if (field instanceof ZodNull) {
    return null;
  }

  if (field instanceof ZodString) {
    return <Input type='text' {...props} />;
  }

  if (field instanceof ZodNumber) {
    return <Input type='number' {...props} />;
  }

  if (field instanceof ZodBoolean) {
    return (
      <label>
        <Input type='checkbox' {...props} />
      </label>
    );
  }

  return <input type='text' {...props} />;
}
