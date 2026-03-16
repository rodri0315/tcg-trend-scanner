import Link from 'next/link';
import type { ReactNode } from 'react';

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="chrome">
      <header className="topbar">
        <div>
          <p className="eyebrow">Internal TCG Scanner</p>
          <h1>Market Pulse Console</h1>
        </div>
        <nav className="nav">
          <Link href="/">Overview</Link>
          <Link href="/cards">Watchlist</Link>
        </nav>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
