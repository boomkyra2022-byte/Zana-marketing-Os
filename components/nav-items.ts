export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/creative-generator', label: 'Creative Generator' },
  { href: '/video-analyzer', label: 'Video Analyzer' },
  { href: '/knowledge', label: 'Knowledge Base' },
  { href: '/products', label: 'Products' },
  { href: '/personas', label: 'Personas' },
  { href: '/winners', label: 'Winners / Learnings' },
  { href: '/settings', label: 'Settings' }
];
