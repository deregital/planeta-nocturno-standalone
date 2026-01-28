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
      maximumFractionDigits: 2,
    })
    .replace(/\s/g, '');
}

export function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = Math.floor(Math.random() * 30) + 40; // Entre 40% y 70%
  const lightness = Math.floor(Math.random() * 20) + 40; // Entre 40% y 60%
  const [r, g, b] = hslToRgb(hue / 360, saturation / 100, lightness / 100);
  const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  return color;
}

function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

// Helper function to lighten a color
export function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.min(
    255,
    (num >> 16) + Math.round((255 - (num >> 16)) * percent),
  );
  const g = Math.min(
    255,
    ((num >> 8) & 0x00ff) + Math.round((255 - ((num >> 8) & 0x00ff)) * percent),
  );
  const b = Math.min(
    255,
    (num & 0x0000ff) + Math.round((255 - (num & 0x0000ff)) * percent),
  );
  return `#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Parsea YYYY-MM-DD o ISO (ej. 2001-07-18T...) como fecha local. */
export function parseDateOnly(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return new Date(y, m - 1, d);
}
