'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from 'react-aria-components';

interface MobileNavProps {
  links: Array<{ href: string; label: string }>;
}

export function MobileNav({ links }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        className="mobileMenuButton"
        onPress={() => setIsOpen(!isOpen)}
        aria-label="Toggle navigation menu"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </Button>

      {isOpen && (
        <div className="mobileMenuOverlay" onClick={() => setIsOpen(false)}>
          <nav className="mobileMenu" onClick={(e) => e.stopPropagation()}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="mobileMenuItem"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
