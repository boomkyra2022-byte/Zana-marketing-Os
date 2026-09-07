'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_HOME, NAV_SETTINGS, NAV_GROUPS } from './nav-items';

// Sidebar nav — replaces the old top-nav header shell. Two explicit user
// requests drove this in sequence:
// 1. "ไม่เอาแท็บเมนูขอบด้านบน ให้ย้ายมาอยู่ในแท็บข้างแทน" — move the top nav
//    into a side nav.
// 2. "จัดหน้าตาของเว็บฉันให้สวยงามแบบนี้เลย" pointing at a reference
//    dashboard (tina-live-session.netlify.app/content_dashboard_demo) —
//    style it to match: cream background, soft terracotta active state,
//    grouped sections with small colored labels. Colors/fonts come from
//    app/globals.css's --accent-terracotta*/--accent-{group} variables and
//    the sidebar-group-{slug} classes defined there.
//
// Brand block + user/logout are passed in as props/children from the
// server layout (app/(dashboard)/layout.tsx) since the auth check and the
// signOut server action both need to stay server-side.

interface Props {
  brandTitle: string;
  brandSubtitle: string;
  userLabel: string;
  roleLabel: string;
  children?: React.ReactNode;
}

export function SideNav({ brandTitle, brandSubtitle, userLabel, roleLabel, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function navLink(item: { href: string; label: string }) {
    const active = pathname.startsWith(item.href);
    return (
      <Link key={item.href} href={item.href} className={`sidebar-link ${active ? 'active' : ''}`} onClick={() => setOpen(false)}>
        {item.label}
      </Link>
    );
  }

  return (
    <>
      {/* Mobile top bar — sidebar is off-canvas below md, toggled here */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="min-w-0">
          <div className="font-heading font-bold leading-tight text-sm truncate">{brandTitle}</div>
        </div>
        <button type="button" className="btn-secondary text-sm py-1.5 px-3 shrink-0" onClick={() => setOpen((v) => !v)}>
          {open ? 'ปิดเมนู ✕' : 'เมนู ☰'}
        </button>
      </div>

      {open && <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="mb-6 px-1">
          <div className="font-heading font-bold leading-tight">{brandTitle}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{brandSubtitle}</div>
        </div>

        <nav className="flex-1 space-y-0.5">
          {navLink(NAV_HOME)}
          {NAV_GROUPS.map((group) => (
            <div key={group.slug} className={`mt-3 sidebar-group-${group.slug}`}>
              <div className="sidebar-group-label">{group.label}</div>
              <div className="space-y-0.5 mt-1">{group.items.map((item) => navLink(item))}</div>
            </div>
          ))}
          <div className="mt-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            {navLink(NAV_SETTINGS)}
          </div>
        </nav>

        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="text-sm truncate font-medium">{userLabel}</div>
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{roleLabel}</div>
          {children}
        </div>
      </aside>
    </>
  );
}
