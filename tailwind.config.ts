import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0f172a',
        panel: '#ffffff',
        surface: '#f4f6f8',
        border: '#e2e8f0',
        accentBlue: '#2563eb',
        accentGreen: '#16a34a',
        // Ads Automation module only — matches the CRM's dark zinc-950 + gold theme.
        gold: '#C8A96E'
      }
    }
  },
  plugins: []
};

export default config;
