export interface NavItem {
  href: string;
  label: string;
  phase: number; // phase in which this section becomes functional
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'ศูนย์บัญชาการ', phase: 1 },
  { href: '/creative-factory', label: 'โรงงานครีเอทีฟ', phase: 2 },
  { href: '/video-analyzer', label: 'วิเคราะห์วิดีโอ', phase: 3 },
  { href: '/creative-library', label: 'คลังครีเอทีฟ', phase: 3 },
  { href: '/ads-performance', label: 'ผลลัพธ์โฆษณา', phase: 4 },
  { href: '/winners', label: 'วิดีโอ Winner', phase: 4 },
  { href: '/knowledge', label: 'ฐานความรู้', phase: 1 },
  { href: '/products', label: 'สินค้า', phase: 1 },
  { href: '/personas', label: 'กลุ่มเป้าหมาย', phase: 1 },
  { href: '/offers', label: 'โปรโมชัน', phase: 2 },
  { href: '/team', label: 'ทีมงาน', phase: 4 },
  { href: '/settings', label: 'ตั้งค่า', phase: 1 }
];
