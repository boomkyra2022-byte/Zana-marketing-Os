export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Standalone items — outside the 4 quadrant groups, always first/last in the nav.
export const NAV_HOME: NavItem = { href: '/dashboard', label: 'Dashboard' };
export const NAV_SETTINGS: NavItem = { href: '/settings', label: 'Settings' };

// Grouped to match the Dashboard's 4-quadrant "AI Marketing Department" layout
// (app/(dashboard)/dashboard/page.tsx) — explicit user follow-up after seeing
// the redesigned Dashboard: "จัดแค่หน้า Dashboard หรอ แล้วแท็ปอื่นๆ จัดหน้าตาให้เข้ามา
// เป็นแท็ปเล็กๆด้วยได้ไหม" — same Intelligence/Strategy/Distribution/Analytics
// categories, applied to the top nav so it reads as organized small clusters
// instead of one long flat scrollable list of 11 links.
//
// Grouping logic (same reasoning as the Dashboard quadrants):
// - Intelligence = context/insight sources (Knowledge Base, Winners/Learnings)
// - Strategy = planning + reference data that feeds a creative plan
//   (Creative Generator, Flow Prompt Director, Products, Personas)
// - Distribution = tools that produce a publishable asset (Editor, Voiceover)
// - Analytics = tools that measure what already ran (Video Analyzer, Ads Automation)
export const NAV_GROUPS: NavGroup[] = [
  {
    label: '01 · Intelligence',
    items: [
      { href: '/knowledge', label: 'Knowledge Base' },
      { href: '/winners', label: 'Winners / Learnings' }
    ]
  },
  {
    label: '02 · Strategy',
    items: [
      { href: '/creative-generator', label: 'Creative Generator' },
      { href: '/flow-prompt', label: 'Flow Prompt Director' },
      { href: '/products', label: 'Products' },
      { href: '/personas', label: 'Personas' }
    ]
  },
  {
    label: '03 · Distribution',
    items: [
      { href: '/editor', label: 'Editor' },
      { href: '/voiceover', label: 'พากย์เสียง' }
    ]
  },
  {
    label: '04 · Analytics',
    items: [
      { href: '/video-analyzer', label: 'Video Analyzer' },
      { href: '/ads', label: 'Ads Automation' }
    ]
  }
];

// Flat list kept for anything that still wants every link in order — no
// current call site needs it (only top-nav.tsx imports from this file), but
// cheap to keep for back-compat.
export const NAV_ITEMS: NavItem[] = [NAV_HOME, ...NAV_GROUPS.flatMap((g) => g.items), NAV_SETTINGS];
