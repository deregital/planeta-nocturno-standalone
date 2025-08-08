import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'pn-primary': 'var(--pn-primary-color)',
        'pn-secondary': 'var(--pn-secondary-color)',
        'pn-accent': 'var(--pn-accent-color)',
        'pn-background': 'var(--pn-background-color)',
        'pn-text-primary': 'var(--pn-text-primary-color)',
        'pn-text-secondary': 'var(--pn-text-secondary-color)',
        'pn-text-accent': 'var(--pn-text-accent-color)',
        'pn-gray': 'var(--pn-gray)',
      },
      text: {
        'pn-primary': 'var(--pn-text-primary-color)',
        'pn-secondary': 'var(--pn-text-secondary-color)',
      },
    },
  },
  plugins: [
    plugin(function ({ addBase }) {
      addBase({
        ':root': {
          '--pn-primary-color':
            process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#F59E0B',
          '--pn-secondary-color':
            process.env.NEXT_PUBLIC_SECONDARY_COLOR || '#F59E0B',
          '--pn-accent-color':
            process.env.NEXT_PUBLIC_ACCENT_COLOR || '#F59E0B',
          '--pn-background-color':
            process.env.NEXT_PUBLIC_BACKGROUND_COLOR || '#F59E0B',
          '--pn-text-primary-color':
            process.env.NEXT_PUBLIC_TEXT_PRIMARY_COLOR || '#F59E0B',
          '--pn-text-secondary-color':
            process.env.NEXT_PUBLIC_TEXT_SECONDARY_COLOR || '#F59E0B',
          '--pn-text-accent-color':
            process.env.NEXT_PUBLIC_TEXT_ACCENT_COLOR || '#F59E0B',
          // Default NO .env
          '--pn-gray': '#A3A3A3',
        },
      });
    }),
  ],
};

export default config;
