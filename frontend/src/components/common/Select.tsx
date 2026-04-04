import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder = '请选择', className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownId = useRef(`select-${Math.random().toString(36).slice(2)}`);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const dropdown = document.getElementById(dropdownId.current);
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdown && !dropdown.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const rect = triggerRef.current?.getBoundingClientRect();
  const dropdown = open ? (
    <div
      id={dropdownId.current}
      style={{
        position: 'fixed',
        top: rect ? rect.bottom + 4 : 0,
        left: rect?.left ?? 0,
        width: rect?.width ?? 'auto',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
        zIndex: 1000,
        overflow: 'hidden',
        animation: 'selectIn 0.15s ease',
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => { onChange(opt.value); setOpen(false); }}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: opt.value === value ? 'var(--muted-card)' : 'transparent',
            color: opt.value === value ? 'var(--primary)' : 'var(--input-text)',
            fontWeight: opt.value === value ? 700 : 400,
            fontSize: 14,
            textAlign: 'left',
            cursor: 'pointer',
            border: 0,
            display: 'block',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted-card)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = opt.value === value ? 'var(--muted-card)' : 'transparent')}
        >
          {opt.label}
        </button>
      ))}
      <style>{`
        @keyframes selectIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}
      >
        <span style={{ color: selected ? 'var(--input-text)' : 'var(--text-secondary)' }}>
          {selected?.label || placeholder}
        </span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>▼</span>
      </button>
      {createPortal(dropdown, document.body)}
    </>
  );
}
