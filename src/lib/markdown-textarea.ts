export const TEXT_FORMATS = {
  bold: {
    open: '**',
    close: '**',
    placeholder: 'texto en negrita',
  },
  italic: {
    open: '*',
    close: '*',
    placeholder: 'texto en cursiva',
  },
  underline: {
    open: '<u>',
    close: '</u>',
    placeholder: 'texto subrayado',
  },
} as const;

export type TextFormat = keyof typeof TEXT_FORMATS;

export function applyTextareaUpdate(
  textarea: HTMLTextAreaElement,
  newValue: string,
  selectionStart: number,
  selectionEnd: number,
) {
  textarea.value = newValue;
  textarea.focus();
  textarea.setSelectionRange(selectionStart, selectionEnd);
}

export function wrapMarkdownSelection(
  textarea: HTMLTextAreaElement,
  openMarker: string,
  closeMarker = openMarker,
  placeholder = 'texto',
) {
  const { value, selectionStart, selectionEnd } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const text = selected || placeholder;
  const wrapped = `${openMarker}${text}${closeMarker}`;
  const newValue =
    value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd);

  if (selected) {
    applyTextareaUpdate(
      textarea,
      newValue,
      selectionStart,
      selectionStart + wrapped.length,
    );
    return;
  }

  applyTextareaUpdate(
    textarea,
    newValue,
    selectionStart + openMarker.length,
    selectionStart + openMarker.length + text.length,
  );
}

export function applyTextFormat(
  textarea: HTMLTextAreaElement,
  format: TextFormat,
) {
  const { open, close, placeholder } = TEXT_FORMATS[format];
  wrapMarkdownSelection(textarea, open, close, placeholder);
}

export function insertMarkdownLink(
  textarea: HTMLTextAreaElement,
  url: string,
  linkText = 'texto del enlace',
) {
  const { value, selectionStart, selectionEnd } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const text = selected || linkText;
  const markdown = `[${text}](${url})`;
  const newValue =
    value.slice(0, selectionStart) + markdown + value.slice(selectionEnd);

  if (selected) {
    applyTextareaUpdate(
      textarea,
      newValue,
      selectionStart + markdown.length,
      selectionStart + markdown.length,
    );
    return;
  }

  applyTextareaUpdate(
    textarea,
    newValue,
    selectionStart + 1,
    selectionStart + 1 + text.length,
  );
}

export function normalizeLinkUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
