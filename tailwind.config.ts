import type { Config } from 'tailwindcss';

import plugin from 'tailwindcss/plugin';

// eslint-disable-next-line no-restricted-imports
import { getColors } from './src/lib/get-colors';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  plugins: [
    plugin(({ addBase }) => {
      const {
        textOnAccent,
        accentDark,
        accentColor,
        buttonColor,
        brandColor,
        accentLight,
        accentUltraLight,
      } = getColors();

      addBase({
        ':root': {
          '--accent-dark-color': accentDark,
          '--accent-color': accentColor,
          '--button-color': buttonColor,
          '--brand-color': brandColor,
          '--accent-light-color': accentLight,
          '--accent-ultra-light-color': accentUltraLight,
          '--on-accent-color': textOnAccent,
          '--stroke-color': accentColor,
          '--pn-black-color': accentDark,
        },
      });
    }),
  ],
};

export default config;
