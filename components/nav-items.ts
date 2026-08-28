export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/creative-generator', label: 'Creative Generator' },
  { href: '/video-analyzer', label: 'Video Analyzer' },
  { href: '/editor', label: 'Editor' },
  { href: '/voiceover', label: 'พากย์เสียง' },
  // Banner/Ads Image Generator lives as a tab inside Creative Generator
  // now (explicit user request — "เพิ่มลงในหน้านี้... ทำเป็นอีก 1 หัวข้อ"),
  // not its own top-level nav item, to avoid two confusing paths to the
  // same tool. The route app/(dashboard)/banner-generator/page.tsx still
  // works if linked directly, just isn't in the main nav bar.
  { href: '/flow-prompt', label: 'Flow Prompt Director' },
  { href: '/knowledge', label: 'Knowledge Base' },
  { href: '/products', label: 'Products' },
  { href: '/personas', label: 'Personas' },
  { href: '/winners', label: 'Winners / Learnings' },
  { href: '/ads', label: 'Ads Automation' },
  { href: '/settings', label: 'Settings' }
];
