import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0f172a',
        panel: '#ffffff',
        // Kept in sync with app/globals.css's --surface/--border (warm
        // cream restyle, matching the reference dashboard the user asked
        // to be styled after) so bg-surface/border-border Tailwind
        // utilities don't silently disagree with the CSS-variable-driven
        // .card/.sidebar rules.
        surface: '#f7f2ea',
        border: '#e5ddd0',
        accentBlue: '#2563eb',
        accentGreen: '#16a34a',
        accentTerracotta: '#c8785c',
        accentTerracottaDark: '#9a4e32',
        // Ads Automation module only — matches the CRM's dark zinc-950 + gold theme.
        gold: '#C8A96E'
      }
    }
  },
  plugins: []
};

export default config;
