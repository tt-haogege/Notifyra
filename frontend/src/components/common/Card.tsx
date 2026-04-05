import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={[
        'card w-full',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </section>
  );
}
