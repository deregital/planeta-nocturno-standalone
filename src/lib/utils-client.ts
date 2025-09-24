'use client';
import * as XLSX from 'xlsx';
export function generateS3Url(objectKey: string): string {
  const bucketUrl = process.env.NEXT_PUBLIC_S3_BUCKET_URL;
  if (!bucketUrl) {
    throw new Error('S3_BUCKET_URL is not set');
  }
  return `${bucketUrl}/${objectKey}`;
}

export function stringifyValue(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function extractTextFromReact(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromReact).join('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((node as any)?.props?.children !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return extractTextFromReact((node as any).props.children);
  }
  return '';
}

export function exportTableToXlsx(
  headers: string[],
  rows: (string | number | Date)[][],
  fileName: string,
) {
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, `${fileName}.xlsx`, { bookType: 'xlsx' });
}

export function exportSheetsToXlsx(
  sheets: {
    name: string;
    headers: string[];
    rows: (string | number | Date)[][];
  }[],
  fileName: string,
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${fileName}.xlsx`, { bookType: 'xlsx' });
}
