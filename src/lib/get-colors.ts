export function getTextColorByBg(bg: string) {
  const color = bg.charAt(0) === '#' ? bg.substring(1, 7) : bg;
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const uicolors = [r / 255, g / 255, b / 255];
  const c = uicolors.map((col) => {
    if (col <= 0.03928) {
      return col / 12.92;
    }
    return Math.pow((col + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return L > 0.179 ? 'black' : 'white';
}

export function getColors() {
  const hue = process.env.NEXT_PUBLIC_HUE ?? '200';
  const saturation = process.env.NEXT_PUBLIC_SATURATION ?? '100';

  const accentDark = `hsl(${hue}, ${saturation}%, 7%)`;
  const accentColor = `hsl(${hue}, ${saturation}%, 20%)`;
  const buttonColor = `hsl(${hue}, ${saturation}%, 36%)`;
  const brandColor = `hsl(${hue}, ${saturation}%, 60%)`;
  const accentLight = `hsl(${hue}, ${saturation}%, 70%)`;
  const accentUltraLight = `hsl(${hue}, ${saturation}%, 97%)`;
  const textOnAccent = getTextColorByBg(accentColor);

  return {
    accentDark,
    accentColor,
    buttonColor,
    brandColor,
    accentLight,
    accentUltraLight,
    textOnAccent,
  };
}

// Helper function to convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(color, 1)))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Function to get colors as hex values
export function getColorsAsHex() {
  const hue = parseInt(process.env.NEXT_PUBLIC_HUE ?? '200');
  const saturation = parseInt(process.env.NEXT_PUBLIC_SATURATION ?? '100');

  return {
    accentDark: hslToHex(hue, saturation, 7),
    accentColor: hslToHex(hue, saturation, 20),
    buttonColor: hslToHex(hue, saturation, 36),
    brandColor: hslToHex(hue, saturation, 60),
    accentLight: hslToHex(hue, saturation, 70),
    accentUltraLight: hslToHex(hue, saturation, 97),
    textOnAccent:
      getTextColorByBg(hslToHex(hue, saturation, 20)) === 'white'
        ? '#ffffff'
        : '#000000', // Use hex version of accentColor
  };
}
