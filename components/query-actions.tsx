'use client';

import { useState } from 'react';

interface QueryActionsProps {
  query: string;
  searchUrl: string;
}

export function QueryActions({ query, searchUrl }: QueryActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="queryActions">
      <button type="button" className="queryActionButton" onClick={handleCopy}>
        {copied ? 'Copied' : 'Copy query'}
      </button>
      <a href={searchUrl} target="_blank" rel="noreferrer" className="debugMetaLink">
        View search
      </a>
    </div>
  );
}
