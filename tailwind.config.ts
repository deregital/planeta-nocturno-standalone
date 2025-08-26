import type { Config } from 'tailwindcss';

import plugin from 'tailwindcss/plugin';

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

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 'pn-primary': 'var(--pn-primary-color)',
        // 'pn-secondary': 'var(--pn-secondary-color)',
        // 'pn-accent': 'var(--pn-accent-color)',
        // 'pn-background': 'var(--pn-background-color)',
        // 'pn-text-primary': 'var(--pn-text-primary-color)',
        // 'pn-text-secondary': 'var(--pn-text-secondary-color)',
        // 'pn-text-accent': 'var(--pn-text-accent-color)',
        'accent-dark': 'var(--accent-dark-color)',
        accent: 'var(--accent-color)',
        'button-color': 'var(--button-color)',
        brand: 'var(--brand-color)',
        'accent-light': 'var(--accent-light-color)',
        'accent-ultra-light': 'var(--accent-ultra-light-color)',
        'text-on-accent': 'var(--text-on-accent-color)',
      },
      text: {
        'pn-primary': 'var(--pn-text-primary-color)',
        'pn-secondary': 'var(--pn-text-secondary-color)',
      },
    },
  },
  plugins: [
    plugin(function ({ addBase }) {
      const hue = process.env.NEXT_PUBLIC_HUE;

      if (!hue) {
        throw new Error('NEXT_PUBLIC_HUE is not set');
      }

      const accentDark = `hsl(${hue}, 100%, 7%)`;
      const accentColor = `hsl(${hue}, 100%, 20%)`;
      const buttonColor = `hsl(${hue}, 100%, 36%)`;
      const brandColor = `hsl(${hue}, 100%, 60%)`;
      const accentLight = `hsl(${hue}, 100%, 70%)`;
      const accentUltraLight = `hsl(${hue}, 100%, 97%)`;

      const textOnAccentColor = getTextColorByBg(accentColor);

      addBase({
        ':root': {
          // '--pn-primary-color':
          //   process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#F59E0B',
          // '--pn-secondary-color':
          //   process.env.NEXT_PUBLIC_SECONDARY_COLOR || '#F59E0B',
          // '--pn-accent-color':
          //   process.env.NEXT_PUBLIC_ACCENT_COLOR || '#F59E0B',
          // '--pn-background-color':
          //   process.env.NEXT_PUBLIC_BACKGROUND_COLOR || '#F59E0B',
          // '--pn-text-primary-color':
          //   process.env.NEXT_PUBLIC_TEXT_PRIMARY_COLOR || '#F59E0B',
          // '--pn-text-secondary-color':
          //   process.env.NEXT_PUBLIC_TEXT_SECONDARY_COLOR || '#F59E0B',
          // '--pn-text-accent-color':
          //   process.env.NEXT_PUBLIC_TEXT_ACCENT_COLOR || '#F59E0B',
          // Default NO .env
          '--accent-dark-color': accentDark,
          '--accent-color': accentColor,
          '--button-color': buttonColor,
          '--brand-color': brandColor,
          '--accent-light-color': accentLight,
          '--accent-ultra-light-color': accentUltraLight,
          '--text-on-accent-color': textOnAccentColor,
        },
      });
    }),
  ],
};

export default config;
