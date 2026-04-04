import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  leaving?: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const TOAST_EVENT = 'app-toast';

export function emitToast(message: string, type: ToastType = 'info') {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }));
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 3000);
  }, []);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; type?: ToastType }>).detail;
      if (!detail?.message) return;
      toast(detail.message, detail.type ?? 'info');
    };

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === 'error'
                ? '#dc2626'
                : t.type === 'success'
                ? '#16a34a'
                : '#4b5563',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              animation: t.leaving ? 'toastOut 0.3s ease forwards' : 'toastIn 0.2s ease',
              maxWidth: 320,
            }}
          >
            {t.type === 'success' && '✓ '}
            {t.type === 'error' && '✕ '}
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-8px); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
