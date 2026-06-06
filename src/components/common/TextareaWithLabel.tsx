import GenericInputWithLabel from '@/components/common/GenericInputWithLabel';
import { Textarea } from '@/components/ui/textarea';

interface TextareaWithLabelProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  id: string;
  error?: string;
  hint?: string;
}

export default function TextareaWithLabel({
  label,
  id,
  className,
  error,
  hint,
  ...textareaProps
}: TextareaWithLabelProps) {
  return (
    <GenericInputWithLabel
      label={label}
      id={id}
      className={className}
      required={textareaProps.required}
      error={error}
    >
      <div className='flex w-full flex-col gap-1'>
        <Textarea id={id} {...textareaProps} className='border-stroke py-2' />
        {hint && (
          <p className='pl-1 text-xs leading-relaxed text-accent-dark/70'>
            {hint}
          </p>
        )}
      </div>
    </GenericInputWithLabel>
  );
}
