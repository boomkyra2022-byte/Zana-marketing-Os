'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-items';

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? 'bg-accentRed/20 text-accentRed font-semibold' : 'text-gray-300 hover:bg-white/5'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
