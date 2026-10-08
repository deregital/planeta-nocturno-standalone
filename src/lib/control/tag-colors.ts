/** Paleta en el mismo rango que `randomColor` de Expo Manager (saturación 40-70 %, luz 40-60 %). */
export const TAG_COLOR_PRESETS = [
  '#CC3333',
  '#CC7333',
  '#CCA633',
  '#80CC33',
  '#33CC66',
  '#33CCBF',
  '#3399CC',
  '#3359CC',
  '#6633CC',
  '#B333CC',
  '#CC3380',
  '#666666',
] as const;

export const TAG_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function getTextColorByBg(bg: string) {
  const color = bg.charAt(0) === '#' ? bg.substring(1, 7) : bg;
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const [lr, lg, lb] = [r / 255, g / 255, b / 255].map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  return luminance > 0.179 ? 'black' : 'white';
}
