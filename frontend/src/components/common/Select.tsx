import { useState, useRef, useEffect, useId } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value?: string;
  values?: string[];
  onChange?: (value: string) => void;
  onValuesChange?: (values: string[]) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  dropdownClassName?: string;
  multiple?: boolean;
}

export function Select({
  value = '',
  values,
  onChange,
  onValuesChange,
  options,
  placeholder = '请选择',
  className,
  dropdownClassName,
  multiple = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownId = useId();
  const selectedValues = multiple ? (values ?? []) : [value];
  const selected = options.find((o) => o.value === value);
  const selectedOptions = options.filter((o) => selectedValues.includes(o.value));
  const triggerLabel = multiple
    ? selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length <= 2
        ? selectedOptions.map((option) => option.label).join('、')
        : `${selectedOptions.slice(0, 2).map((option) => option.label).join('、')} +${selectedOptions.length - 2}`
    : (selected?.label || placeholder);

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: 280,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
        zIndex: 1000,
        animation: 'selectIn 0.15s ease',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, dropdownId]);

  const dropdown = open ? (
    <div
      id={dropdownId}
      className={dropdownClassName}
      style={dropdownStyle}
    >
      {options.map((opt) => {
        const isSelected = selectedValues.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (multiple) {
                const nextValues = isSelected
                  ? selectedValues.filter((selectedValue) => selectedValue !== opt.value)
                  : [...selectedValues, opt.value];
                onValuesChange?.(nextValues);
                return;
              }
              onChange?.(opt.value);
              setOpen(false);
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: isSelected ? 'var(--muted-card)' : 'transparent',
              color: isSelected ? 'var(--primary)' : 'var(--input-text)',
              fontWeight: isSelected ? 700 : 400,
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              border: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted-card)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? 'var(--muted-card)' : 'transparent')}
          >
            <span>{opt.label}</span>
            {multiple && isSelected ? <span style={{ color: 'var(--primary)', fontSize: 12 }}>✓</span> : null}
          </button>
        );
      })}
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
        style={{ width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px' }}
      >
        <span style={{ color: selectedValues.length > 0 ? 'var(--input-text)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {triggerLabel}
        </span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 10, flexShrink: 0 }}>▼</span>
      </button>
      {createPortal(dropdown, document.body)}
    </>
  );
}
