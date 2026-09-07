'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_HOME, NAV_SETTINGS, NAV_GROUPS } from './nav-items';

// Grouped into small labeled clusters matching the Dashboard's 4-quadrant
// layout — explicit follow-up request after the Dashboard redesign: "จัดแค่
// หน้า Dashboard หรอ แล้วแท็ปอื่นๆ จัดหน้าตาให้เข้ามาเป็นแท็ปเล็กๆด้วยได้ไหม".
// Same active-link logic as before, just rendered in groups with a small
// muted uppercase label ahead of each cluster instead of one flat list.
export function TopNav() {
  const pathname = usePathname();

  function navLink(item: { href: string; label: string }) {
    const active = pathname.startsWith(item.href);
    return (
      <Link key={item.href} href={item.href} className={`top-nav-link whitespace-nowrap ${active ? 'active' : ''}`}>
        {item.label}
      </Link>
    );
  }

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {navLink(NAV_HOME)}

      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex items-center gap-1 pl-2 ml-1 border-l border-white/10">
          <span className="text-[10px] uppercase tracking-wide text-white/30 whitespace-nowrap px-1">{group.label}</span>
          {group.items.map((item) => navLink(item))}
        </div>
      ))}

      <div className="flex items-center pl-2 ml-1 border-l border-white/10">{navLink(NAV_SETTINGS)}</div>
    </nav>
  );
}
