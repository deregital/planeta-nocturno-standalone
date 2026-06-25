'use client';

import { Bold, Italic, Link2, Underline } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import GenericInputWithLabel from '@/components/common/GenericInputWithLabel';
import EventDescriptionContent from '@/components/event/buyPage/EventDescriptionContent';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  applyTextFormat,
  insertMarkdownLink,
  normalizeLinkUrl,
  type TextFormat,
} from '@/lib/markdown-textarea';

const FORMAT_TOOLBAR_ITEMS: {
  format: TextFormat;
  icon: typeof Bold;
  label: string;
}[] = [
  { format: 'bold', icon: Bold, label: 'Negrita' },
  { format: 'italic', icon: Italic, label: 'Cursiva' },
  { format: 'underline', icon: Underline, label: 'Subrayado' },
];

interface MarkdownTextareaWithLabelProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  showPreview?: boolean;
}

export default function MarkdownTextareaWithLabel({
  label,
  id,
  className,
  error,
  hint,
  showPreview = true,
  disabled,
  readOnly,
  onChange,
  value,
  defaultValue,
  ...textareaProps
}: MarkdownTextareaWithLabelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkSelection, setLinkSelection] = useState('');
  const [previewValue, setPreviewValue] = useState(() =>
    String(value ?? defaultValue ?? ''),
  );

  useEffect(() => {
    if (value !== undefined) {
      setPreviewValue(String(value));
    }
  }, [value]);

  const isEditable = !disabled && !readOnly;

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPreviewValue(e.target.value);
    onChange?.(e);
  }

  function notifyChange() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    setPreviewValue(textarea.value);
    if (!onChange) return;

    onChange({
      target: textarea,
      currentTarget: textarea,
    } as React.ChangeEvent<HTMLTextAreaElement>);
  }

  function applyFormat(format: TextFormat) {
    const textarea = textareaRef.current;
    if (!textarea || !isEditable) return;

    applyTextFormat(textarea, format);
    notifyChange();
  }

  function openLinkDialog() {
    const textarea = textareaRef.current;
    if (!textarea || !isEditable) return;

    const selected = textarea.value.slice(
      textarea.selectionStart,
      textarea.selectionEnd,
    );
    setLinkSelection(selected);
    setLinkUrl('https://');
    setLinkDialogOpen(true);
  }

  function applyLink() {
    const textarea = textareaRef.current;
    const url = normalizeLinkUrl(linkUrl);
    if (!textarea || !url) return;

    insertMarkdownLink(textarea, url);
    notifyChange();
    setLinkDialogOpen(false);
    setLinkUrl('https://');
    setLinkSelection('');
  }

  return (
    <>
      <GenericInputWithLabel
        label={label}
        id={id}
        className={className}
        required={textareaProps.required}
        error={error}
      >
        <div className='flex w-full flex-col gap-1'>
          {isEditable && (
            <div className='flex items-center gap-1 rounded-md border border-stroke bg-accent-ultra-light/40 p-1'>
              {FORMAT_TOOLBAR_ITEMS.map(({ format, icon: Icon, label }) => (
                <Button
                  key={format}
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-8 text-accent'
                  aria-label={label}
                  title={label}
                  onClick={() => applyFormat(format)}
                >
                  <Icon className='size-4' />
                </Button>
              ))}
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-8 text-accent'
                aria-label='Enlace'
                title='Enlace'
                onClick={openLinkDialog}
              >
                <Link2 className='size-4' />
              </Button>
              <span className='ml-1 hidden text-xs text-accent-dark/60 sm:inline'>
                Seleccioná texto y usá los botones para formatear
              </span>
            </div>
          )}
          <Textarea
            ref={textareaRef}
            id={id}
            disabled={disabled}
            readOnly={readOnly}
            onChange={handleChange}
            value={value}
            defaultValue={defaultValue}
            {...textareaProps}
            className='border-stroke py-2'
          />
          {hint && (
            <p className='pl-1 text-xs leading-relaxed text-accent-dark/70'>
              {hint}
            </p>
          )}
          {showPreview && (
            <div className='mt-1 flex flex-col gap-1'>
              <p className='pl-1 text-sm text-accent'>Vista previa</p>
              <div className='pl-1'>
                {previewValue.trim() ? (
                  <EventDescriptionContent description={previewValue} />
                ) : (
                  <p className='text-sm italic text-accent-dark/50'>
                    La vista previa aparecerá aquí mientras escribís.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </GenericInputWithLabel>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Agregar enlace</DialogTitle>
          </DialogHeader>
          <div className='flex flex-col gap-3'>
            {linkSelection ? (
              <p className='text-sm text-accent-dark/80'>
                Texto del enlace:{' '}
                <span className='font-semibold text-accent-dark'>
                  {linkSelection}
                </span>
              </p>
            ) : (
              <p className='text-sm text-accent-dark/80'>
                Se insertará{' '}
                <span className='font-semibold text-accent-dark'>
                  texto del enlace
                </span>{' '}
                como texto por defecto. Podés editarlo después en el campo.
              </p>
            )}
            <div className='flex flex-col gap-1'>
              <label
                htmlFor={`${id}-link-url`}
                className='pl-1 text-sm text-accent'
              >
                URL
              </label>
              <Input
                id={`${id}-link-url`}
                type='url'
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder='https://ejemplo.com'
                className='border-stroke'
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setLinkDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type='button'
              variant='accent'
              disabled={!normalizeLinkUrl(linkUrl)}
              onClick={applyLink}
            >
              Insertar enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
