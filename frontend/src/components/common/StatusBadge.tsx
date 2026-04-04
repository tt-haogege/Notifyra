import type { ReactNode } from 'react';

type Tone = 'blue' | 'green' | 'red' | 'orange' | 'slate';

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}
