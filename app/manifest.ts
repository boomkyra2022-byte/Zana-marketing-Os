import type { MetadataRoute } from 'next';

// PWA manifest (served at /manifest.webmanifest; Next adds the <link>).
// Lets the team install ZANA Marketing OS on a phone's home screen and open
// it full-screen like an app. Colours follow globals.css (--accent-terracotta,
// --surface).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ZANA Marketing OS',
    short_name: 'ZANA OS',
    description: 'ระบบการตลาด ZANA — Content Studio, Creative Generator, Ads และเครื่องมือทีม',
    lang: 'th',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f2ea',
    theme_color: '#c8785c',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ],
    shortcuts: [
      { name: 'Content Studio', url: '/content-studio', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Creative Generator', url: '/creative-generator', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }
    ]
  };
}
