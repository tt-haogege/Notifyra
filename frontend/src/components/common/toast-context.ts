import { createContext, useContext } from 'react';
import type { ToastType } from './toast-events';

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const useToast = () => useContext(ToastContext);

export { ToastContext, useToast };
export type { ToastContextValue };
