'use client';

import * as XLSX from 'xlsx';
export function generateS3Url(objectKey: string): string {
  const bucketUrl = process.env.NEXT_PUBLIC_S3_BUCKET_URL;
  if (!bucketUrl) {
    throw new Error('S3_BUCKET_URL is not set');
  }
  return `${bucketUrl}/${objectKey}`;
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

export function formatCurrency(price: number): string {
  return price
    .toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/\s/g, '');
}
