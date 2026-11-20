import type { Metadata, Viewport } from 'next';
import Pwa from '@/components/pwa';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZANA Marketing OS V2',
  description: 'Creative Generator + AI Video Analyzer — ZANA Marketing OS V2',
  applicationName: 'ZANA OS',
  // PWA: manifest comes from app/manifest.ts; these cover iPhone home-screen installs.
  appleWebApp: { capable: true, title: 'ZANA OS', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }]
  }
};

// Explicit viewport (Next.js normally injects a default, but making it
// explicit rules out mobile-scaling as a cause of the "no mobile UI"
// report and is a zero-risk change either way).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#c8785c'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
