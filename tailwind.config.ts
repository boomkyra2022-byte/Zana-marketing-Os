import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: '#111214',
        panel: '#1a1b1e',
        accentRed: '#e6394b',
        accentTeal: '#2ad1c9'
      }
    }
  },
  plugins: []
};

export default config;
