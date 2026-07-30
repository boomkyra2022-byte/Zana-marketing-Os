import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZANA Marketing OS',
  description: 'Creative Factory, Video Analyzer, Winner Engine — ZANA Marketing OS'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
