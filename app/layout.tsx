import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZANA Marketing OS V2',
  description: 'Creative Generator + AI Video Analyzer — ZANA Marketing OS V2'
};

// Explicit viewport (Next.js normally injects a default, but making it
// explicit rules out mobile-scaling as a cause of the "no mobile UI"
// report and is a zero-risk change either way).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
