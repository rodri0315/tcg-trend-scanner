import Link from 'next/link';
import type { ReactNode } from 'react';

import { MobileNav } from './mobile-nav';

interface DashboardShellProps {
  children: ReactNode;
}

const navLinks = [
  { href: '/', label: 'Overview' },
  { href: '/cards', label: 'Watchlist' },
  { href: '/cards/new', label: 'Add Card' },
];

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="chrome">
      <header className="topbar">
        <div>
          <p className="eyebrow">Internal TCG Scanner</p>
          <h1>Market Pulse Console</h1>
        </div>
        <nav className="nav nav--desktop">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="nav--mobile">
          <MobileNav links={navLinks} />
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
