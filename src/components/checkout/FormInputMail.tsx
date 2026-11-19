'use client';

import { useState } from 'react';

import { type PurchaseActionState } from '@/app/(client)/checkout/action';
import InputWithLabel from '@/components/common/InputWithLabel';
import { shouldWarnEmailTypo } from '@/lib/email-typo';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  tag: string;
  state: PurchaseActionState;
}

export default function FormInputMail({
  tag,
  state,
  defaultValue,
  onChange,
  onBlur,
  onInput,
  ...inputProps
}: InputProps) {
  const initial =
    state.formData?.[tag] ??
    (typeof defaultValue === 'string' ? defaultValue : '');
  const [value, setValue] = useState(initial);
  const [settled, setSettled] = useState(true);
  const serverError =
    typeof state.errors === 'object' && state.errors !== null
      ? (state.errors as Record<string, string>)[tag]
      : undefined;

  return (
    <InputWithLabel
      {...inputProps}
      name={tag}
      id={tag}
      label='Mail'
      type='email'
      required
      autoCapitalize='none'
      autoCorrect='off'
      spellCheck={false}
      defaultValue={initial}
      onChange={(event) => {
        setValue(event.target.value);
        setSettled(false);
        onChange?.(event);
      }}
      onInput={(event) => {
        setValue(event.currentTarget.value);
        onInput?.(event);
      }}
      onBlur={(event) => {
        setValue(event.target.value);
        setSettled(true);
        onBlur?.(event);
      }}
      error={serverError}
      warning={
        serverError
          ? undefined
          : (shouldWarnEmailTypo(value, settled) ?? undefined)
      }
    />
  );
}
