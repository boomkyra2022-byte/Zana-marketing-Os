'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-items';

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={`top-nav-link whitespace-nowrap ${active ? 'active' : ''}`}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
