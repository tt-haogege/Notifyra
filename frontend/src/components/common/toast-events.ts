export type ToastType = 'success' | 'error' | 'info';

const TOAST_EVENT = 'app-toast';

export function emitToast(message: string, type: ToastType = 'info') {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }));
}

export { TOAST_EVENT };
