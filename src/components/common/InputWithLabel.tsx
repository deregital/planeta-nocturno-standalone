import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useState } from 'react';

import GenericInputWithLabel from '@/components/common/GenericInputWithLabel';
import { Input } from '@/components/ui/input';

interface InputWithLabelProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
}

export default function InputWithLabel({
  label,
  id,
  className,
  error,
  ...inputProps
}: InputWithLabelProps) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <GenericInputWithLabel
      label={label}
      id={id}
      className={className}
      required={inputProps.required}
      error={error}
    >
      {inputProps.type === 'password' ? (
        <div className='relative'>
          <Input
            id={id}
            {...inputProps}
            type={showPassword ? 'text' : 'password'}
            className='border-stroke py-2 pr-8'
          />
          {showPassword ? (
            <EyeIcon
              className='w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer'
              onClick={() => {
                setShowPassword(!showPassword);
              }}
            />
          ) : (
            <EyeOffIcon
              className='w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer'
              onClick={() => {
                setShowPassword(!showPassword);
              }}
            />
          )}
        </div>
      ) : (
        <Input id={id} {...inputProps} className='border-stroke py-2' />
      )}
    </GenericInputWithLabel>
  );
}
